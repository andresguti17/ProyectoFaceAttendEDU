package handler

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// Actor scope of the caller, same rule as the Java services (05-attendance
// CallerScopeResolver): Super Administrador sees every alert (nil scope, no
// school of its own); Administrador sees only the alerts of actors in its own
// school; everyone else sees the alerts of their own academic actors plus,
// for instructors, the active students of the cohorts they teach. Cached 60 s
// per user.

const actorScopeKey = "actorScope"

const actorPageSize = 100

const (
	superAdminRole  = "Super Administrador"
	schoolAdminRole = "Administrador"
)

type cachedScope struct {
	actors    map[int64]bool
	expiresAt time.Time
}

var scopeCache sync.Map // userID -> cachedScope

func isAlertPath(path string) bool {
	return strings.HasPrefix(path, "/api/v1/alerts") || strings.HasPrefix(path, "/alerts")
}

func resolveActorScope(ctx context.Context, cfg AuthConfig, userID, token string) (map[int64]bool, error) {
	var roles []struct {
		RoleName string `json:"roleName"`
	}
	if _, err := getJSONStrict(ctx, cfg, cfg.AuthorizationURL+"/api/v1/users/"+url.PathEscape(userID)+"/roles", token, &roles); err != nil {
		return nil, err
	}
	isSuperAdmin := false
	isSchoolAdmin := false
	for _, r := range roles {
		switch r.RoleName {
		case superAdminRole:
			isSuperAdmin = true
		case schoolAdminRole:
			isSchoolAdmin = true
		}
	}
	if isSuperAdmin {
		return nil, nil
	}
	if hit, ok := scopeCache.Load(userID); ok && hit.(cachedScope).expiresAt.After(time.Now()) {
		return hit.(cachedScope).actors, nil
	}

	var user struct {
		PersonID string `json:"personId"`
	}
	if _, err := getJSONStrict(ctx, cfg, cfg.IdentityURL+"/api/v1/users/"+url.PathEscape(userID), token, &user); err != nil {
		return nil, err
	}
	var actors []struct {
		AcademicActorID int64  `json:"academicActorId"`
		PersonID        string `json:"personId"`
		SchoolID        *int64 `json:"schoolId"`
	}
	// The academic service caps each page at actorPageSize, so the full list is walked page by page.
	for offset := 0; ; offset += actorPageSize {
		var page []struct {
			AcademicActorID int64  `json:"academicActorId"`
			PersonID        string `json:"personId"`
			SchoolID        *int64 `json:"schoolId"`
		}
		pageURL := fmt.Sprintf("%s/api/v1/academic-actors?limit=%d&offset=%d", cfg.AcademicURL, actorPageSize, offset)
		if _, err := getJSONStrict(ctx, cfg, pageURL, token, &page); err != nil {
		return nil, err
	}
		actors = append(actors, page...)
		if len(page) < actorPageSize {
			break
		}
	}
	scope := map[int64]bool{}
	var own []int64
	for _, a := range actors {
		if user.PersonID != "" && strings.EqualFold(a.PersonID, user.PersonID) {
			scope[a.AcademicActorID] = true
			own = append(own, a.AcademicActorID)
		}
	}

	if isSchoolAdmin {
		// Administrador de sede: solo los actores de su propia sede, nunca los
		// de otras instituciones (a diferencia de Super Administrador = nil).
		ownSchools := map[int64]bool{}
		for _, a := range actors {
			if scope[a.AcademicActorID] && a.SchoolID != nil {
				ownSchools[*a.SchoolID] = true
			}
		}
		adminScope := map[int64]bool{}
		if len(ownSchools) > 0 {
			for _, a := range actors {
				if a.SchoolID != nil && ownSchools[*a.SchoolID] {
					adminScope[a.AcademicActorID] = true
				}
			}
		} else {
			// Sin sede propia (no debería ocurrir para un Administrador): falla
			// seguro, solo sus propios actores en vez de caer a "ver todo".
			adminScope = scope
		}
		scopeCache.Store(userID, cachedScope{actors: adminScope, expiresAt: time.Now().Add(time.Minute)})
		return adminScope, nil
	}

	for _, actorID := range own {
		var blocks []struct {
			CohortID int64 `json:"cohortId"`
		}
		if _, err := getJSONStrict(ctx, cfg, fmt.Sprintf("%s/api/v1/schedule-blocks?instructorActorId=%d", cfg.SchedulingURL, actorID), token, &blocks); err != nil {
			return nil, err
		}
		for _, b := range blocks {
			var enrollments []struct {
				AcademicActorID  int64  `json:"academicActorId"`
				EnrollmentStatus string `json:"enrollmentStatus"`
			}
			if _, err := getJSONStrict(ctx, cfg, fmt.Sprintf("%s/api/v1/cohorts/%d/enrollments", cfg.AcademicURL, b.CohortID), token, &enrollments); err != nil {
				return nil, err
			}
			for _, e := range enrollments {
				if e.EnrollmentStatus == "Active" {
					scope[e.AcademicActorID] = true
				}
			}
		}
	}
	scopeCache.Store(userID, cachedScope{actors: scope, expiresAt: time.Now().Add(time.Minute)})
	return scope, nil
}

// getJSONStrict is getJSON that treats any non-200 answer as an error: a
// partial scope must never widen what the caller can see.
func getJSONStrict(ctx context.Context, cfg AuthConfig, target, token string, out any) (int, error) {
	status, err := getJSONOnce(ctx, cfg, target, token, out)
	if err != nil && isTransient(status) {
		// One retry after a short pause: under load a single slow or reset
		// inter-service call was enough to answer 503. A second failure still
		// propagates, so the scope keeps failing secure.
		select {
		case <-time.After(retryPause):
		case <-ctx.Done():
			return status, err
		}
		status, err = getJSONOnce(ctx, cfg, target, token, out)
	}
	if err != nil {
		log.Printf("actor scope: %v", err)
	}
	return status, err
}

const retryPause = 250 * time.Millisecond

// isTransient: transport failure (status 0) or a 5xx answer; 4xx are final.
func isTransient(status int) bool { return status == 0 || status >= 500 }

func getJSONOnce(ctx context.Context, cfg AuthConfig, target, token string, out any) (int, error) {
	status, err := getJSON(ctx, cfg.Client, target, token, out)
	if err == nil && status != http.StatusOK {
		err = fmt.Errorf("GET %s answered %d", target, status)
	}
	return status, err
}

// actorAllowed reports whether the request's scope (if any) includes actorID.
func actorAllowed(c *gin.Context, actorID int64) bool {
	value, ok := c.Get(actorScopeKey)
	if !ok || value == nil {
		return true
	}
	scope, _ := value.(map[int64]bool)
	return scope == nil || scope[actorID]
}
