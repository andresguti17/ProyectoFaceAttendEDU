package usecase

import (
	"context"
	"errors"
	"time"

	"github.com/faceattend/notification-service/internal/domain"
	"github.com/faceattend/notification-service/internal/domain/port"
)

// JustificationReviewed is the integration event Attendance publishes on
// attendance.justification.events when a justification is approved or rejected
// (fae-docs 09-microservices/event-catalog.md).
type JustificationReviewed struct {
	EventType       string    `json:"eventType"`
	JustificationID int64     `json:"justificationId"`
	AcademicActorID int64     `json:"academicActorId"`
	Status          string    `json:"status"`
	ReviewedAt      time.Time `json:"reviewedAt"`
}

// ErrInvalidEvent marks a message that can never be processed: retrying it
// would only block the partition, so the consumer logs it and moves on.
var ErrInvalidEvent = errors.New("invalid JustificationReviewed event")

var resultAlertCode = map[string]string{
	"Approved": "JUSTIFICATION_APPROVED",
	"Rejected": "JUSTIFICATION_REJECTED",
}

type notifyJustificationResult struct {
	alerts port.AlertRepository
	types  port.AlertTypeRepository
}

func NewNotifyJustificationResult(alerts port.AlertRepository, types port.AlertTypeRepository) *notifyJustificationResult {
	return &notifyJustificationResult{alerts: alerts, types: types}
}

// Handle raises the DASHBOARD alert the apprentice sees in Novedades (ERF 6.3).
// Delivery is at-least-once, so it is idempotent on the natural key
// (actor, alert type, raised_at = reviewedAt): a redelivered event finds its
// alert and does nothing.
func (uc *notifyJustificationResult) Handle(ctx context.Context, ev JustificationReviewed) error {
	code, ok := resultAlertCode[ev.Status]
	if !ok || ev.AcademicActorID == 0 || ev.ReviewedAt.IsZero() {
		return ErrInvalidEvent
	}
	alertType, err := uc.types.FindByCode(ctx, code)
	if err != nil {
		return err // missing seed or DB down: retried until fixed
	}
	raisedAt := ev.ReviewedAt.UTC().Truncate(time.Microsecond) // column precision
	actorID, typeID := ev.AcademicActorID, alertType.AlertTypeID
	existing, err := uc.alerts.FindAll(ctx, port.AlertFilter{ActorID: &actorID, TypeID: &typeID})
	if err != nil {
		return err
	}
	for _, a := range existing {
		if a.RaisedAt.Equal(raisedAt) {
			return nil
		}
	}
	_, err = uc.alerts.Save(ctx, domain.Alert{
		AcademicActorID: actorID,
		AlertTypeID:     typeID,
		RaisedAt:        raisedAt,
		CreatedAt:       time.Now().UTC(),
		RowVersion:      1,
	})
	return err
}
