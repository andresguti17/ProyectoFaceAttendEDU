package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"

	"github.com/faceattend/notification-service/internal/domain"
	"github.com/faceattend/notification-service/internal/domain/port"
)

const teacherSession = "44444444-4444-4444-4444-444444444444"

type fakeAlerts struct{ resolved []int64 }

var scopedAlerts = []domain.Alert{{AlertID: 1, AcademicActorID: 2}, {AlertID: 2, AcademicActorID: 9}}

func (f *fakeAlerts) Create(context.Context, port.CreateAlertCommand) (int64, error) { return 0, nil }
func (f *fakeAlerts) List(context.Context, port.ListAlertsQuery) ([]domain.Alert, error) {
	return append([]domain.Alert(nil), scopedAlerts...), nil
}
func (f *fakeAlerts) Get(_ context.Context, id int64) (*domain.Alert, error) {
	for _, a := range scopedAlerts {
		if a.AlertID == id {
			alert := a
			return &alert, nil
		}
	}
	return nil, domain.ErrNotFound{Entity: "alert"}
}
func (f *fakeAlerts) Resolve(_ context.Context, id int64) (*domain.Alert, error) {
	f.resolved = append(f.resolved, id)
	return f.Get(context.Background(), id)
}
func (f *fakeAlerts) DeleteAlert(context.Context, int64) error { return nil }

// Instructor (actor 1) teaches cohort 7, where actor 2 is an active student; actor 9 is not.
func scopedBackends(t *testing.T) AuthConfig {
	t.Helper()
	mux := http.NewServeMux()
	write := func(body string) http.HandlerFunc {
		return func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte(body)) }
	}
	mux.HandleFunc("/api/v1/sessions/", write(`{"sessionStatus":"Active","userId":"teacher"}`))
	mux.HandleFunc("/api/v1/auth/evaluate", write(`{"allowed":true}`))
	mux.HandleFunc("/api/v1/users/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/roles") {
			_, _ = w.Write([]byte(`[{"roleName":"Instructor"}]`))
			return
		}
		_, _ = w.Write([]byte(`{"personId":"p-1"}`))
	})
	mux.HandleFunc("/api/v1/academic-actors", write(`[{"academicActorId":1,"personId":"p-1"},{"academicActorId":2,"personId":"p-2"},{"academicActorId":9,"personId":"p-9"}]`))
	mux.HandleFunc("/api/v1/schedule-blocks", write(`[{"cohortId":7}]`))
	mux.HandleFunc("/api/v1/cohorts/7/enrollments", write(`[{"academicActorId":2,"enrollmentStatus":"Active"}]`))
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return AuthConfig{IdentityURL: srv.URL, AuthorizationURL: srv.URL, AcademicURL: srv.URL, SchedulingURL: srv.URL, Client: srv.Client()}
}

func TestInstructorSeesAndResolvesOnlyOwnStudentsAlerts(t *testing.T) {
	scopeCache.Delete("teacher")
	gin.SetMode(gin.TestMode)
	alerts := &fakeAlerts{}
	r := gin.New()
	r.Use(AuthMiddleware(scopedBackends(t), NotificationPermission))
	NewAlertHandler(alerts, alerts, alerts, alerts).Register(r)

	do := func(method, path string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, nil)
		req.Header.Set("Authorization", "Bearer "+teacherSession)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w
	}

	list := do(http.MethodGet, "/api/v1/alerts")
	assert.Equal(t, http.StatusOK, list.Code)
	var body struct {
		Alerts []domain.Alert `json:"alerts"`
	}
	assert.NoError(t, json.Unmarshal(list.Body.Bytes(), &body))
	assert.Len(t, body.Alerts, 1)
	assert.Equal(t, int64(2), body.Alerts[0].AcademicActorID)

	assert.Equal(t, http.StatusForbidden, do(http.MethodGet, "/api/v1/alerts/2").Code)
	assert.Equal(t, http.StatusForbidden, do(http.MethodPatch, "/api/v1/alerts/2/resolve").Code)
	assert.Equal(t, http.StatusOK, do(http.MethodPatch, "/api/v1/alerts/1/resolve").Code)
	assert.Equal(t, []int64{1}, alerts.resolved)
}

// School admin (actor 1, school 100) must not see alerts from actor 9 (school 200).
func schoolAdminBackends(t *testing.T) AuthConfig {
	t.Helper()
	mux := http.NewServeMux()
	write := func(body string) http.HandlerFunc {
		return func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte(body)) }
	}
	mux.HandleFunc("/api/v1/sessions/", write(`{"sessionStatus":"Active","userId":"admin"}`))
	mux.HandleFunc("/api/v1/auth/evaluate", write(`{"allowed":true}`))
	mux.HandleFunc("/api/v1/users/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/roles") {
			_, _ = w.Write([]byte(`[{"roleName":"Administrador"}]`))
			return
		}
		_, _ = w.Write([]byte(`{"personId":"p-admin"}`))
	})
	mux.HandleFunc("/api/v1/academic-actors", write(`[{"academicActorId":1,"personId":"p-admin","schoolId":100},{"academicActorId":2,"personId":"p-2","schoolId":100},{"academicActorId":9,"personId":"p-9","schoolId":200}]`))
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return AuthConfig{IdentityURL: srv.URL, AuthorizationURL: srv.URL, AcademicURL: srv.URL, SchedulingURL: srv.URL, Client: srv.Client()}
}

func TestSchoolAdminSeesOnlyOwnSchoolAlerts(t *testing.T) {
	scopeCache.Delete("admin")
	gin.SetMode(gin.TestMode)
	alerts := &fakeAlerts{}
	r := gin.New()
	r.Use(AuthMiddleware(schoolAdminBackends(t), NotificationPermission))
	NewAlertHandler(alerts, alerts, alerts, alerts).Register(r)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/alerts", nil)
	req.Header.Set("Authorization", "Bearer "+teacherSession)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var body struct {
		Alerts []domain.Alert `json:"alerts"`
	}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	// Actor 2 (same school) is visible; actor 9 (school 200) must not be.
	assert.Len(t, body.Alerts, 1)
	assert.Equal(t, int64(2), body.Alerts[0].AcademicActorID)
}

// The session cache answers the second request: the scope must still be
// resolved for the cached user (it used to be resolved for an empty id → 503).
func TestActorScopeSurvivesCachedSession(t *testing.T) {
	scopeCache.Delete("admin")
	gin.SetMode(gin.TestMode)
	alerts := &fakeAlerts{}
	r := gin.New()
	r.Use(AuthMiddleware(schoolAdminBackends(t), NotificationPermission))
	NewAlertHandler(alerts, alerts, alerts, alerts).Register(r)

	for i := 0; i < 3; i++ {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/alerts", nil)
		req.Header.Set("Authorization", "Bearer "+teacherSession)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code, "request %d", i+1)
	}
}
