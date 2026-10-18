package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// AuthConfig wires the session + RBAC guard, which follows the same contract
// as the Java AuthTokenFilter: the Bearer is an opaque session UUID validated
// against identity, and the permission is evaluated by authorization.
type AuthConfig struct {
	IdentityURL      string
	AuthorizationURL string
	// AcademicURL/SchedulingURL resolve the actor scope of alert reads; empty
	// (as in unit tests of the bare guard) skips the scope.
	AcademicURL   string
	SchedulingURL string
	Disabled      bool
	Client        *http.Client
}

// AuthConfigFromEnv reads IDENTITY_URL, AUTHORIZATION_URL, ACADEMIC_URL, SCHEDULING_URL and AUTH_ENABLED.
func AuthConfigFromEnv() AuthConfig {
	return AuthConfig{
		IdentityURL:      envOr("IDENTITY_URL", "http://localhost:8081"),
		AuthorizationURL: envOr("AUTHORIZATION_URL", "http://localhost:8082"),
		AcademicURL:      envOr("ACADEMIC_URL", "http://localhost:8083"),
		SchedulingURL:    envOr("SCHEDULING_URL", "http://localhost:8084"),
		Disabled:         strings.EqualFold(os.Getenv("AUTH_ENABLED"), "false"),
		Client:           &http.Client{Timeout: 4 * time.Second},
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

var sessionIDPattern = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

// Caché positiva de autenticación (TTL corto). Cada request autenticado
// costaba 1-2 introspecciones secuenciales; bajo fan-out eso saturaba
// identity/authorization y el gateway respondía 503. Solo se cachean
// resultados POSITIVOS: cualquier fallo se revalida en vivo (fail-secure).
// Ventana de revocación/logout: authCacheTTL.
const authCacheTTL = 10 * time.Second
const authCacheMax = 5000

type cacheEntry struct {
	value   string
	expires time.Time
}

var authCache = struct {
	sync.RWMutex
	session map[string]cacheEntry
	eval    map[string]cacheEntry
}{session: map[string]cacheEntry{}, eval: map[string]cacheEntry{}}

func cacheGet(m map[string]cacheEntry, key string) (string, bool) {
	v, ok := m[key]
	if !ok || time.Now().After(v.expires) {
		return "", false
	}
	return v.value, true
}

func cachePut(m map[string]cacheEntry, key, value string) {
	if len(m) > authCacheMax {
		clear(m)
	}
	m[key] = cacheEntry{value: value, expires: time.Now().Add(authCacheTTL)}
}

// NotificationPermission maps a request to the permission it needs ("" = any
// valid session). Alerts are readable by every role, staff resolves them; creating or deleting them
// and managing alert types is an administrative action.
func NotificationPermission(method, path string) string {
	switch {
	case strings.HasPrefix(path, "/api/v1/quality"):
		return "configuration:manage"
	case method == http.MethodGet:
		return "notification.alert:read"
	case method == http.MethodPatch && strings.HasSuffix(path, "/resolve"):
		// Resolving an alert is follow-up of an absence: staff only (admin, instructor).
		return "attendance.record:write"
	default:
		return "configuration:manage"
	}
}

func isPublicPath(path string) bool {
	// /api/v1/emails is internal-only: it carries its own X-Internal-Token and has no gateway route.
	return path == "/health" || strings.HasPrefix(path, "/health/") ||
		path == "/api/v1/health" || path == "/api/health" || path == "/api/v1/emails"
}

// AuthMiddleware requires an active session and, when the rule returns one, a permission.
func AuthMiddleware(cfg AuthConfig, rule func(method, path string) string) gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path
		if cfg.Disabled || c.Request.Method == http.MethodOptions || isPublicPath(path) {
			c.Next()
			return
		}
		header := c.GetHeader("Authorization")
		if len(header) < 7 || !strings.EqualFold(header[:7], "bearer ") {
			abort(c, http.StatusUnauthorized, "Missing bearer token")
			return
		}
		token := strings.TrimSpace(header[7:])
		if !sessionIDPattern.MatchString(token) {
			abort(c, http.StatusUnauthorized, "Invalid token format")
			return
		}

		var session struct {
			SessionStatus string `json:"sessionStatus"`
			UserID        string `json:"userId"`
		}
		var userID string
		authCache.RLock()
		cachedUserID, sessionHit := cacheGet(authCache.session, token)
		authCache.RUnlock()
		if sessionHit {
			userID = cachedUserID
		} else {
			status, err := getJSON(c.Request.Context(), cfg.Client, cfg.IdentityURL+"/api/v1/sessions/"+token, token, &session)
			if err != nil {
				abort(c, http.StatusServiceUnavailable, "Cannot verify session")
				return
			}
			if status != http.StatusOK || session.SessionStatus != "Active" || session.UserID == "" {
				abort(c, http.StatusUnauthorized, "Invalid or expired session")
				return
			}
			userID = session.UserID
			authCache.Lock()
			cachePut(authCache.session, token, userID)
			authCache.Unlock()
		}

		if permission := rule(c.Request.Method, path); permission != "" {
			evalKey := token + "\n" + userID + "\n" + permission
			authCache.RLock()
			_, evalHit := cacheGet(authCache.eval, evalKey)
			authCache.RUnlock()
			if !evalHit {
				var result struct {
					Allowed bool `json:"allowed"`
				}
				target := cfg.AuthorizationURL + "/api/v1/auth/evaluate?userId=" + url.QueryEscape(userID) +
					"&permission=" + url.QueryEscape(permission)
				status, err := getJSON(c.Request.Context(), cfg.Client, target, token, &result)
				if err != nil {
					abort(c, http.StatusServiceUnavailable, "Cannot verify permissions")
					return
				}
				if status != http.StatusOK || !result.Allowed {
					abort(c, http.StatusForbidden, "Forbidden: requires "+permission)
					return
				}
				authCache.Lock()
				cachePut(authCache.eval, evalKey, "1")
				authCache.Unlock()
			}
		}
		if cfg.AcademicURL != "" && isAlertPath(path) {
			scope, err := resolveActorScope(c.Request.Context(), cfg, userID, token)
			if err != nil {
				abort(c, http.StatusServiceUnavailable, "Cannot resolve actor scope")
				return
			}
			if scope != nil {
				c.Set(actorScopeKey, scope)
			}
		}
		c.Set("userID", userID)
		c.Next()
	}
}

func getJSON(ctx context.Context, client *http.Client, target, token string, out any) (int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		_ = json.NewDecoder(resp.Body).Decode(out)
	}
	return resp.StatusCode, nil
}

func abort(c *gin.Context, status int, message string) {
	name := "ServiceUnavailable"
	switch status {
	case http.StatusUnauthorized:
		name = "Unauthorized"
	case http.StatusForbidden:
		name = "Forbidden"
	}
	c.AbortWithStatusJSON(status, gin.H{"status": status, "error": name, "message": message, "path": c.Request.URL.Path})
}
