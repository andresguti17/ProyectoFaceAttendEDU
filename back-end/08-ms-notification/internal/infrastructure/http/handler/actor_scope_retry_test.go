package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetJSONStrictRetriesTransientFailureOnce(t *testing.T) {
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if atomic.AddInt32(&calls, 1) == 1 {
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer srv.Close()

	var out struct{ OK bool }
	status, err := getJSONStrict(context.Background(), AuthConfig{Client: srv.Client()}, srv.URL, "t", &out)

	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, status)
	assert.Equal(t, int32(2), atomic.LoadInt32(&calls))
}

func TestGetJSONStrictDoesNotRetryClientErrorsAndStillFailsSecure(t *testing.T) {
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		atomic.AddInt32(&calls, 1)
		w.WriteHeader(http.StatusForbidden)
	}))
	defer srv.Close()

	var out struct{}
	_, err := getJSONStrict(context.Background(), AuthConfig{Client: srv.Client()}, srv.URL, "t", &out)

	assert.Error(t, err)
	assert.Equal(t, int32(1), atomic.LoadInt32(&calls))
}

func TestGetJSONStrictPersistentTransportFailureIsAnError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	url := srv.URL
	srv.Close()

	var out struct{}
	_, err := getJSONStrict(context.Background(), AuthConfig{Client: http.DefaultClient}, url, "t", &out)

	assert.Error(t, err)
}
