package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/faceattend/notification-service/internal/infrastructure/config"
	"github.com/faceattend/notification-service/internal/infrastructure/http/handler"
	"github.com/faceattend/notification-service/internal/infrastructure/kafka"
)

var startedAt = time.Now()

func newRequestID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return time.Now().UTC().Format("20060102150405.000000000")
	}
	return hex.EncodeToString(b)
}

func iso25010Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = newRequestID()
		}
		c.Set("requestID", requestID)
		c.Header("X-Request-ID", requestID)
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		start := time.Now()
		c.Next()
		c.Header("X-Process-Time-Ms", time.Since(start).String())
	}
}

func healthPayload(service string) gin.H {
	return gin.H{
		"status":        "ok",
		"service":       service,
		"version":       "0.1.0",
		"uptimeSeconds": int(time.Since(startedAt).Seconds()),
		"timestamp":     time.Now().UTC().Format(time.RFC3339),
	}
}

func main() {
	r := gin.Default()
	r.Use(iso25010Middleware())
	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, healthPayload("notification-service")) })
	r.GET("/api/v1/health", func(c *gin.Context) { c.JSON(http.StatusOK, healthPayload("notification-service")) })
	r.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{"error": "NotFound", "message": "Route " + c.Request.Method + " " + c.Request.URL.Path + " not found", "timestamp": time.Now().UTC().Format(time.RFC3339)})
	})
	r.NoMethod(func(c *gin.Context) {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"error": "MethodNotAllowed", "message": "Method not allowed", "timestamp": time.Now().UTC().Format(time.RFC3339)})
	})

	// Try to connect to Postgres if DATABASE_URL is set
	databaseURL := os.Getenv("DATABASE_URL")
	var pool *pgxpool.Pool
	if databaseURL != "" {
		p, err := pgxpool.New(context.Background(), databaseURL)
		if err != nil {
			log.Printf("WARN: failed to create pool: %v", err)
		} else {
			if err := p.Ping(context.Background()); err != nil {
				log.Printf("WARN: failed to ping DB: %v", err)
			} else {
				pool = p
				defer pool.Close()
				log.Println("connected to postgres")
			}
		}
	} else {
		log.Println("DATABASE_URL not set, running without DB (handlers will return 500 on DB ops)")
	}

	// Wire hexagonal dependencies (even if pool is nil, handlers are registered)
	// ISO/IEC 9001 — Quality audit middleware (Cláusula 8.5.2 / 9.1)
	r.Use(handler.QualityAuditMiddleware())
	r.Use(handler.AuthMiddleware(handler.AuthConfigFromEnv(), handler.NotificationPermission))
	r.GET("/health/quality", handler.QualityHealthHandler())
	r.GET("/api/v1/quality/report", handler.QualityHealthHandler())

	container := config.Wire(pool)
	if container != nil {
		if container.AlertHandler != nil {
			container.AlertHandler.Register(r)
		}
		if container.AlertTypeHandler != nil {
			container.AlertTypeHandler.Register(r)
		}
		if container.EmailHandler != nil {
			container.EmailHandler.Register(r)
		}
		// ERF 6.3: alert the apprentice when a justification is approved or rejected.
		if brokers := os.Getenv("KAFKA_BROKERS"); brokers != "" && pool != nil {
			go kafka.RunJustificationConsumer(context.Background(), strings.Split(brokers, ","), container.JustificationResult)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8088"
	}
	log.Printf("notification-service listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("failed to run: %v", err)
	}
}
