package kafka

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/faceattend/notification-service/internal/application/usecase"
)

type recordingHandler struct {
	got []usecase.JustificationReviewed
}

func (h *recordingHandler) Handle(_ context.Context, ev usecase.JustificationReviewed) error {
	h.got = append(h.got, ev)
	return nil
}

func TestTheAttendancePayloadReachesTheUseCase(t *testing.T) {
	h := &recordingHandler{}
	// Same shape ReviewJustificationUseCaseImpl publishes (Java Instant with microseconds).
	payload := `{"eventType":"JustificationReviewed","version":1,"justificationId":4,"attendanceRecordId":9,` +
		`"academicActorId":1,"status":"Rejected","reviewedAt":"2026-10-17T15:43:53.607318Z"}`

	require.NoError(t, process(context.Background(), h, []byte(payload)))

	require.Len(t, h.got, 1)
	assert.Equal(t, int64(1), h.got[0].AcademicActorID)
	assert.Equal(t, "Rejected", h.got[0].Status)
	assert.Equal(t, time.Date(2026, 10, 17, 15, 43, 53, 607318000, time.UTC), h.got[0].ReviewedAt)
}

func TestOtherEventsOnTheTopicAreIgnored(t *testing.T) {
	h := &recordingHandler{}
	require.NoError(t, process(context.Background(), h, []byte(`{"eventType":"JustificationSubmitted","justificationId":4}`)))
	assert.Empty(t, h.got)
}

func TestMalformedPayloadIsInvalidNotRetried(t *testing.T) {
	assert.ErrorIs(t, process(context.Background(), &recordingHandler{}, []byte(`{not json`)), usecase.ErrInvalidEvent)
}

func TestBackoffGrowsAndIsCapped(t *testing.T) {
	assert.Equal(t, time.Second, backoff(0))
	assert.Equal(t, 4*time.Second, backoff(2))
	assert.Equal(t, maxBackoff, backoff(10))
}
