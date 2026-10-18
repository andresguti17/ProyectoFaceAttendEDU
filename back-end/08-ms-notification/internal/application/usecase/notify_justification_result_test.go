package usecase

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/faceattend/notification-service/internal/domain"
	"github.com/faceattend/notification-service/internal/domain/port"
)

type memAlerts struct {
	saved   []domain.Alert
	findErr error
}

func (m *memAlerts) Save(_ context.Context, a domain.Alert) (int64, error) {
	m.saved = append(m.saved, a)
	return int64(len(m.saved)), nil
}
func (m *memAlerts) FindByID(context.Context, int64) (*domain.Alert, error) { return nil, nil }
func (m *memAlerts) FindAll(_ context.Context, f port.AlertFilter) ([]domain.Alert, error) {
	if m.findErr != nil {
		return nil, m.findErr
	}
	var out []domain.Alert
	for _, a := range m.saved {
		if (f.ActorID == nil || *f.ActorID == a.AcademicActorID) && (f.TypeID == nil || *f.TypeID == a.AlertTypeID) {
			out = append(out, a)
		}
	}
	return out, nil
}
func (m *memAlerts) Update(context.Context, domain.Alert) error { return nil }
func (m *memAlerts) Delete(context.Context, int64) error        { return nil }

type memTypes struct{ byCode map[string]int16 }

func (m memTypes) Save(context.Context, domain.AlertType) (int16, error)      { return 0, nil }
func (m memTypes) FindByID(context.Context, int16) (*domain.AlertType, error) { return nil, nil }
func (m memTypes) FindByCode(_ context.Context, code string) (*domain.AlertType, error) {
	id, ok := m.byCode[code]
	if !ok {
		return nil, domain.ErrNotFound{Entity: "alert_type", ID: code}
	}
	return &domain.AlertType{AlertTypeID: id, Code: code}, nil
}
func (m memTypes) FindAll(context.Context, int, int) ([]domain.AlertType, error) { return nil, nil }
func (m memTypes) Update(context.Context, domain.AlertType) error                { return nil }
func (m memTypes) Delete(context.Context, int16) error                           { return nil }

var seededTypes = memTypes{byCode: map[string]int16{"JUSTIFICATION_APPROVED": 6, "JUSTIFICATION_REJECTED": 7}}

func reviewed(status string) JustificationReviewed {
	return JustificationReviewed{
		EventType: "JustificationReviewed", JustificationID: 4, AcademicActorID: 1, Status: status,
		ReviewedAt: time.Date(2026, 10, 17, 15, 43, 53, 607318999, time.UTC),
	}
}

func TestEachResultRaisesItsOwnAlertTypeForTheApprentice(t *testing.T) {
	alerts := &memAlerts{}
	uc := NewNotifyJustificationResult(alerts, seededTypes)

	require.NoError(t, uc.Handle(context.Background(), reviewed("Approved")))
	ev := reviewed("Rejected")
	ev.ReviewedAt = ev.ReviewedAt.Add(time.Hour)
	require.NoError(t, uc.Handle(context.Background(), ev))

	require.Len(t, alerts.saved, 2)
	assert.Equal(t, int64(1), alerts.saved[0].AcademicActorID)
	assert.Equal(t, int16(6), alerts.saved[0].AlertTypeID)
	assert.Equal(t, int16(7), alerts.saved[1].AlertTypeID)
	assert.Nil(t, alerts.saved[0].ResolvedAt)
}

func TestARedeliveredEventDoesNotDuplicateTheAlert(t *testing.T) {
	alerts := &memAlerts{}
	uc := NewNotifyJustificationResult(alerts, seededTypes)

	require.NoError(t, uc.Handle(context.Background(), reviewed("Rejected")))
	require.NoError(t, uc.Handle(context.Background(), reviewed("Rejected")))

	require.Len(t, alerts.saved, 1)
	assert.Equal(t, 0, alerts.saved[0].RaisedAt.Nanosecond()%1000, "raised_at keeps the column's microsecond precision")
}

func TestEventsThatCanNeverBeProcessedAreInvalid(t *testing.T) {
	uc := NewNotifyJustificationResult(&memAlerts{}, seededTypes)
	noActor := reviewed("Approved")
	noActor.AcademicActorID = 0
	noDate := reviewed("Approved")
	noDate.ReviewedAt = time.Time{}

	for _, ev := range []JustificationReviewed{reviewed("Pending"), reviewed("Maybe"), noActor, noDate} {
		assert.ErrorIs(t, uc.Handle(context.Background(), ev), ErrInvalidEvent)
	}
}

func TestStorageFailuresAreReturnedSoTheConsumerRetries(t *testing.T) {
	uc := NewNotifyJustificationResult(&memAlerts{findErr: errors.New("db down")}, seededTypes)
	err := uc.Handle(context.Background(), reviewed("Approved"))
	assert.Error(t, err)
	assert.NotErrorIs(t, err, ErrInvalidEvent)

	missingSeed := NewNotifyJustificationResult(&memAlerts{}, memTypes{byCode: map[string]int16{}})
	assert.NotErrorIs(t, missingSeed.Handle(context.Background(), reviewed("Approved")), ErrInvalidEvent)
}
