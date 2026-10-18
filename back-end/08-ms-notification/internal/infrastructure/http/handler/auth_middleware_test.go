package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

const (
	adminSession   = "11111111-1111-1111-1111-111111111111"
	studentSession = "22222222-2222-2222-2222-222222222222"
	closedSession  = "33333333-3333-3333-3333-333333333333"
)

func fakeBackends(t *testing.T) AuthConfig {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/sessions/", func(w http.ResponseWriter, r *http.Request) {
		id := strings.TrimPrefix(r.URL.Path, "/api/v1/sessions/")
		switch id {
		case adminSession:
			_, _ = w.Write([]byte(`{"sessionStatus":"Active","userId":"admin"}`))
		case studentSession:
			_, _ = w.Write([]byte(`{"sessionStatus":"Active","userId":"student"}`))
		case closedSession:
			_, _ = w.Write([]byte(`{"sessionStatus":"Closed","userId":"admin"}`))
		default:
			http.NotFound(w, r)
		}
	})
	mux.HandleFunc("/api/v1/auth/evaluate", func(w http.ResponseWriter, r *http.Request) {
		user, permission := r.URL.Query().Get("userId"), r.URL.Query().Get("permission")
		allowed := user == "admin" || (user == "student" && permission == "notification.alert:read")
		if allowed {
			_, _ = w.Write([]byte(`{"allowed":true}`))
		} else {
			_, _ = w.Write([]byte(`{"allowed":false}`))
		}
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return AuthConfig{IdentityURL: srv.URL, AuthorizationURL: srv.URL, Client: srv.Client()}
}

func guardedRouter(cfg AuthConfig) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(AuthMiddleware(cfg, NotificationPermission))
	ok := func(c *gin.Context) { c.String(http.StatusOK, "ok") }
	r.GET("/health", ok)
	r.GET("/api/v1/alerts", ok)
	r.POST("/api/v1/alerts", ok)
	r.POST("/api/v1/emails", ok)
	return r
}

func call(r *gin.Engine, method, path, token string) int {
	req := httptest.NewRequest(method, path, nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w.Code
}

func TestAuthMiddleware(t *testing.T) {
	r := guardedRouter(fakeBackends(t))

	assert.Equal(t, http.StatusOK, call(r, http.MethodGet, "/health", ""), "health is public")
	assert.Equal(t, http.StatusOK, call(r, http.MethodPost, "/api/v1/emails", ""), "emails use their own internal token")
	assert.Equal(t, http.StatusUnauthorized, call(r, http.MethodGet, "/api/v1/alerts", ""), "missing token")
	assert.Equal(t, http.StatusUnauthorized, call(r, http.MethodGet, "/api/v1/alerts", "abc"), "malformed token")
	assert.Equal(t, http.StatusUnauthorized, call(r, http.MethodGet, "/api/v1/alerts", closedSession), "closed session")
	assert.Equal(t, http.StatusOK, call(r, http.MethodGet, "/api/v1/alerts", studentSession), "student reads alerts")
	assert.Equal(t, http.StatusForbidden, call(r, http.MethodPost, "/api/v1/alerts", studentSession), "student cannot create alerts")
	assert.Equal(t, http.StatusOK, call(r, http.MethodPost, "/api/v1/alerts", adminSession), "admin creates alerts")
}

func TestAuthMiddlewareDisabled(t *testing.T) {
	cfg := fakeBackends(t)
	cfg.Disabled = true
	assert.Equal(t, http.StatusOK, call(guardedRouter(cfg), http.MethodGet, "/api/v1/alerts", ""))
}

func TestAuthMiddlewareIdentityDown(t *testing.T) {
	// The auth cache is process-wide: forget sessions cached by earlier tests.
	authCache.Lock()
	authCache.session = map[string]cacheEntry{}
	authCache.eval = map[string]cacheEntry{}
	authCache.Unlock()
	cfg := fakeBackends(t)
	cfg.IdentityURL = "http://127.0.0.1:1"
	assert.Equal(t, http.StatusServiceUnavailable, call(guardedRouter(cfg), http.MethodGet, "/api/v1/alerts", adminSession))
}

func TestNotificationPermission(t *testing.T) {
	cases := []struct{ method, path, want string }{
		{http.MethodGet, "/api/v1/alerts", "notification.alert:read"},
		{http.MethodPatch, "/api/v1/alerts/5/resolve", "attendance.record:write"},
		{http.MethodPost, "/api/v1/alert-types", "configuration:manage"},
		{http.MethodGet, "/api/v1/quality/x", "configuration:manage"},
	}
	for _, c := range cases {
		if got := NotificationPermission(c.method, c.path); got != c.want {
			t.Errorf("%s %s = %q, want %q", c.method, c.path, got, c.want)
		}
	}
}
