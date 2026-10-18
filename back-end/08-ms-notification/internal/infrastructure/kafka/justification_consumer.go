package kafka

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	kafkago "github.com/segmentio/kafka-go"

	"github.com/faceattend/notification-service/internal/application/usecase"
)

// Topic and consumer group from fae-docs 09-microservices/event-catalog.md.
const (
	JustificationTopic = "attendance.justification.events"
	groupID            = "notification-service"
	maxBackoff         = 30 * time.Second
)

type resultHandler interface {
	Handle(ctx context.Context, ev usecase.JustificationReviewed) error
}

// process decodes one message and hands JustificationReviewed to the use case.
// Other event types on the topic (JustificationSubmitted) are not ours: nil.
func process(ctx context.Context, h resultHandler, value []byte) error {
	var ev usecase.JustificationReviewed
	if err := json.Unmarshal(value, &ev); err != nil {
		return fmt.Errorf("%w: %v", usecase.ErrInvalidEvent, err)
	}
	if ev.EventType != "JustificationReviewed" {
		return nil
	}
	return h.Handle(ctx, ev)
}

func backoff(attempt int) time.Duration {
	if attempt >= 5 {
		return maxBackoff
	}
	return time.Second << attempt
}

// RunJustificationConsumer reads until ctx is cancelled. An invalid event is
// logged and committed so it never blocks the partition; any other error is
// retried with exponential backoff and the offset is committed only after the
// alert exists (at-least-once, made safe by the idempotent use case).
// shortcut: no DLQ topic yet, invalid events only reach the log; add one when ops can watch it.
func RunJustificationConsumer(ctx context.Context, brokers []string, h resultHandler) {
	reader := kafkago.NewReader(kafkago.ReaderConfig{
		Brokers: brokers,
		GroupID: groupID,
		Topic:   JustificationTopic,
		// The topic is created by Attendance's first publish, which can happen after this
		// service starts: without watching, the group never gets a partition assigned.
		WatchPartitionChanges: true,
	})
	defer reader.Close()
	log.Printf("justification consumer listening on %s", JustificationTopic)
	for {
		msg, err := reader.FetchMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Printf("WARN: justification consumer fetch: %v", err)
			time.Sleep(time.Second)
			continue
		}
		for attempt := 0; ; attempt++ {
			err := process(ctx, h, msg.Value)
			if err == nil {
				break
			}
			if errors.Is(err, usecase.ErrInvalidEvent) {
				log.Printf("WARN: skipping invalid justification event offset=%d: %v", msg.Offset, err)
				break
			}
			log.Printf("WARN: justification event offset=%d attempt=%d failed, retrying: %v", msg.Offset, attempt+1, err)
			select {
			case <-ctx.Done():
				return
			case <-time.After(backoff(attempt)):
			}
		}
		if err := reader.CommitMessages(ctx, msg); err != nil && ctx.Err() == nil {
			log.Printf("WARN: justification consumer commit offset=%d: %v", msg.Offset, err)
		}
	}
}
