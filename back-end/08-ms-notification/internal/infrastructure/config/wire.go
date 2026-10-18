package config

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/faceattend/notification-service/internal/application/usecase"
	"github.com/faceattend/notification-service/internal/infrastructure/email"
	"github.com/faceattend/notification-service/internal/infrastructure/http/handler"
	"github.com/faceattend/notification-service/internal/infrastructure/postgres"
	"github.com/faceattend/notification-service/internal/infrastructure/webhook"
)

type Container struct {
	AlertHandler     *handler.AlertHandler
	AlertTypeHandler *handler.AlertTypeHandler
	EmailHandler     *handler.EmailHandler
	// JustificationResult turns JustificationReviewed events into the apprentice's alert (ERF 6.3).
	JustificationResult interface {
		Handle(ctx context.Context, ev usecase.JustificationReviewed) error
	}
}

func Wire(pool *pgxpool.Pool) *Container {
	// repos
	alertRepo := postgres.NewAlertRepository(pool)
	alertTypeRepo := postgres.NewAlertTypeRepository(pool)

	// Webhook delivery for EMAIL/PUSH alert_type.channel, driven by WEBHOOK_* env vars.
	alertNotifier := webhook.NewHTTPNotifier(webhook.FromEnv())

	// usecases - if pool is nil (local dev without DB), provide in-memory-like fallback stubs via repos still work (they will error on nil pool but handlers still registered)
	createAlert := usecase.NewCreateAlert(alertRepo, alertTypeRepo, alertNotifier)
	listAlerts := usecase.NewListAlerts(alertRepo)
	resolveAlert := usecase.NewResolveAlert(alertRepo)
	deleteAlert := usecase.NewDeleteAlert(alertRepo)

	createAlertType := usecase.NewCreateAlertType(alertTypeRepo)
	listAlertTypes := usecase.NewListAlertTypes(alertTypeRepo)
	updateAlertType := usecase.NewUpdateAlertType(alertTypeRepo)
	deleteAlertType := usecase.NewDeleteAlertType(alertTypeRepo)

	alertHandler := handler.NewAlertHandler(createAlert, listAlerts, resolveAlert, deleteAlert)
	alertTypeHandler := handler.NewAlertTypeHandler(createAlertType, listAlertTypes, updateAlertType, deleteAlertType)

	// Email channel (SMTP transport + templates) driven by SMTP_* env vars.
	mailCfg := email.FromEnv()
	emailHandler := handler.NewEmailHandler(email.NewSMTPSender(mailCfg), mailCfg)

	return &Container{
		AlertHandler:        alertHandler,
		AlertTypeHandler:    alertTypeHandler,
		EmailHandler:        emailHandler,
		JustificationResult: usecase.NewNotifyJustificationResult(alertRepo, alertTypeRepo),
	}
}
