package qnsp

import (
	"context"
	"net/http"
	"time"

	"github.com/heossihq/qnsi-public/sdks/go/qnsi/access"
	"github.com/heossihq/qnsi-public/sdks/go/qnsi/ai"
	"github.com/heossihq/qnsi-public/sdks/go/qnsi/audit"
	"github.com/heossihq/qnsi-public/sdks/go/qnsi/auth"
	"github.com/heossihq/qnsi-public/sdks/go/qnsi/billing"
	"github.com/heossihq/qnsi-public/sdks/go/qnsi/cryptoinventory"
	"github.com/heossihq/qnsi-public/sdks/go/qnsi/kms"
	"github.com/heossihq/qnsi-public/sdks/go/qnsi/search"
	"github.com/heossihq/qnsi-public/sdks/go/qnsi/storage"
	"github.com/heossihq/qnsi-public/sdks/go/qnsi/tenant"
	"github.com/heossihq/qnsi-public/sdks/go/qnsi/vault"
)

// ClientOptions configures NewClient.
type ClientOptions struct {
	APIKey     string        // required - get one at https://cloud.qnsi.heossi.com/api-keys
	BaseURL    string        // optional override; defaults to production edge gateway
	Timeout    time.Duration // optional per-request timeout; default 15s
	HTTPClient *http.Client  // optional; if nil, the SDK constructs one with Timeout
}

// Client is the top-level QNSP SDK entry point.
type Client struct {
	activator *Activator
	http      *http.Client
	timeout   time.Duration

	vault           *vault.Client
	kms             *kms.Client
	audit           *audit.Client
	auth            *auth.Client
	tenant          *tenant.Client
	access          *access.Client
	billing         *billing.Client
	cryptoInventory *cryptoinventory.Client
	storage         *storage.Client
	search          *search.Client
	ai              *ai.Client
}

// NewClient constructs a new QNSP client.
func NewClient(opts ClientOptions) (*Client, error) {
	timeout := opts.Timeout
	if timeout == 0 {
		timeout = 15 * time.Second
	}
	httpClient := opts.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: timeout}
	}
	act, err := NewActivator(opts.APIKey, opts.BaseURL, timeout, httpClient)
	if err != nil {
		return nil, err
	}
	return &Client{
		activator:       act,
		http:            httpClient,
		timeout:         timeout,
		vault:           vault.New(act, httpClient, timeout),
		kms:             kms.New(act, httpClient, timeout),
		audit:           audit.New(act, httpClient, timeout),
		auth:            auth.New(act, httpClient, timeout),
		tenant:          tenant.New(act, httpClient, timeout),
		access:          access.New(act, httpClient, timeout),
		billing:         billing.New(act, httpClient, timeout),
		cryptoInventory: cryptoinventory.New(act, httpClient, timeout),
		storage:         storage.New(act, httpClient, timeout),
		search:          search.New(act, httpClient, timeout),
		ai:              ai.New(act, httpClient, timeout),
	}, nil
}

func (c *Client) Vault() *vault.Client                     { return c.vault }
func (c *Client) KMS() *kms.Client                         { return c.kms }
func (c *Client) Audit() *audit.Client                     { return c.audit }
func (c *Client) Auth() *auth.Client                       { return c.auth }
func (c *Client) Tenant() *tenant.Client                   { return c.tenant }
func (c *Client) Access() *access.Client                   { return c.access }
func (c *Client) Billing() *billing.Client                 { return c.billing }
func (c *Client) CryptoInventory() *cryptoinventory.Client { return c.cryptoInventory }
func (c *Client) Storage() *storage.Client                 { return c.storage }
func (c *Client) Search() *search.Client                   { return c.search }
func (c *Client) AI() *ai.Client                           { return c.ai }

// EnsureActivated forces the activation handshake to run now, surfacing
// API-key errors at startup rather than on the first service call.
func (c *Client) EnsureActivated(ctx context.Context) error {
	_, err := c.activator.Get(ctx)
	return err
}

func (c *Client) TenantID(ctx context.Context) (string, error) {
	res, err := c.activator.Get(ctx)
	if err != nil {
		return "", err
	}
	return res.TenantID, nil
}

func (c *Client) Tier(ctx context.Context) (string, error) {
	res, err := c.activator.Get(ctx)
	if err != nil {
		return "", err
	}
	return res.Tier, nil
}

func (c *Client) Limits(ctx context.Context) (map[string]any, error) {
	res, err := c.activator.Get(ctx)
	if err != nil {
		return nil, err
	}
	return res.Limits, nil
}

func (c *Client) HasFeature(ctx context.Context, feature string) (bool, error) {
	limits, err := c.Limits(ctx)
	if err != nil {
		return false, err
	}
	v, ok := limits[feature].(bool)
	return ok && v, nil
}

func (c *Client) Activator() *Activator { return c.activator }

func (c *Client) Close() error {
	return nil
}
