package qnsicore

import "net/http"

// doWithoutRedirects copies only the client configuration. It does not mutate
// the caller's client or replace its transport, cookie jar or timeout.
func doWithoutRedirects(client *http.Client, request *http.Request) (*http.Response, error) {
	copy := *client
	copy.CheckRedirect = func(_ *http.Request, _ []*http.Request) error {
		return http.ErrUseLastResponse
	}
	return copy.Do(request)
}
