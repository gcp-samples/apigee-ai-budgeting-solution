package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// ApigeeClient handles authenticated requests to the Apigee v1 API using ADC.
type ApigeeClient struct {
	projectID  string
	httpClient *http.Client
	baseURL    string
}

type resilientTokenSource struct {
	adcTS       oauth2.TokenSource
	cachedToken *oauth2.Token
	mu          sync.Mutex
}

func (s *resilientTokenSource) Token() (*oauth2.Token, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.cachedToken != nil && s.cachedToken.Valid() {
		return s.cachedToken, nil
	}

	// 1. Explicit token override (useful for debugging/testing)
	if tok := os.Getenv("APIGEE_BEARER_TOKEN"); tok != "" {
		s.cachedToken = &oauth2.Token{
			AccessToken: tok,
			TokenType:   "Bearer",
			Expiry:      time.Now().Add(10 * time.Minute),
		}
		return s.cachedToken, nil
	}

	// 2. Primary: Use Application Default Credentials directly
	if s.adcTS != nil {
		tok, err := s.adcTS.Token()
		if err == nil && tok != nil && tok.Valid() {
			s.cachedToken = tok
			return tok, nil
		}
		if err != nil {
			log.Printf("ADC token lookup note: %v", err)
		}
	}

	// 3. Fallback: gcloud auth application-default print-access-token
	out, err := exec.Command("gcloud", "auth", "application-default", "print-access-token").Output()
	if err == nil {
		tokStr := strings.TrimSpace(string(out))
		if tokStr != "" && !strings.Contains(tokStr, " ") {
			s.cachedToken = &oauth2.Token{
				AccessToken: tokStr,
				TokenType:   "Bearer",
				Expiry:      time.Now().Add(45 * time.Minute),
			}
			return s.cachedToken, nil
		}
	}

	// 4. Fallback: gcloud auth print-access-token
	out, err = exec.Command("gcloud", "auth", "print-access-token").Output()
	if err == nil {
		tokStr := strings.TrimSpace(string(out))
		if tokStr != "" && !strings.Contains(tokStr, " ") {
			s.cachedToken = &oauth2.Token{
				AccessToken: tokStr,
				TokenType:   "Bearer",
				Expiry:      time.Now().Add(45 * time.Minute),
			}
			return s.cachedToken, nil
		}
	}

	return nil, fmt.Errorf("no valid application default credentials or access token found")
}

// NewApigeeClient initializes an Apigee client with Application Default Credentials.
func NewApigeeClient(ctx context.Context) (*ApigeeClient, error) {
	projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
	if projectID == "" {
		projectID = os.Getenv("GCP_PROJECT")
	}

	creds, err := google.FindDefaultCredentials(ctx, "https://www.googleapis.com/auth/cloud-platform")
	if err != nil {
		log.Printf("Finding default credentials note: %v", err)
	}

	if projectID == "" && creds != nil && creds.ProjectID != "" {
		projectID = creds.ProjectID
	}

	// Fallback for local development if project still empty
	if projectID == "" {
		out, err := exec.Command("gcloud", "config", "get-value", "project").Output()
		if err == nil {
			projectID = strings.TrimSpace(string(out))
		}
	}

	if projectID == "" {
		projectID = "default"
		log.Printf("Warning: GOOGLE_CLOUD_PROJECT not detected, defaulting to 'default'")
	}

	var adcSource oauth2.TokenSource
	if creds != nil {
		adcSource = creds.TokenSource
	}

	rts := &resilientTokenSource{
		adcTS: adcSource,
	}

	client := oauth2.NewClient(ctx, rts)
	client.Timeout = 35 * time.Second

	return &ApigeeClient{
		projectID:  projectID,
		httpClient: client,
		baseURL:    "https://apigee.googleapis.com/v1/organizations/" + projectID,
	}, nil
}

// GetProjectID returns the current organization / project ID.
func (c *ApigeeClient) GetProjectID() string {
	return c.projectID
}

// doRequest performs an HTTP request with JSON handling.
func (c *ApigeeClient) doRequest(ctx context.Context, method, path string, body interface{}, out interface{}) (int, error) {
	reqURL := c.baseURL + path
	var bodyReader io.Reader
	if body != nil {
		bodyBytes, err := json.Marshal(body)
		if err != nil {
			return 0, fmt.Errorf("marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(bodyBytes)
	}

	req, err := http.NewRequestWithContext(ctx, method, reqURL, bodyReader)
	if err != nil {
		return 0, fmt.Errorf("create request: %w", err)
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode >= 400 {
		return resp.StatusCode, fmt.Errorf("api error (status %d): %s", resp.StatusCode, string(respBytes))
	}

	if out != nil && len(respBytes) > 0 {
		if err := json.Unmarshal(respBytes, out); err != nil {
			return resp.StatusCode, fmt.Errorf("unmarshal response (body: %s): %w", string(respBytes), err)
		}
	}

	return resp.StatusCode, nil
}

// GetEnvironments lists all environments in the organization.
func (c *ApigeeClient) GetEnvironments(ctx context.Context) ([]string, error) {
	var envs []string
	_, err := c.doRequest(ctx, http.MethodGet, "/environments", nil, &envs)
	if err != nil {
		return nil, err
	}
	return envs, nil
}

// EnsureKVM checks if a KeyValueMap exists in an environment; creates it if missing.
func (c *ApigeeClient) EnsureKVM(ctx context.Context, env, kvmName string) error {
	path := fmt.Sprintf("/environments/%s/keyvaluemaps/%s", url.PathEscape(env), url.PathEscape(kvmName))
	var res map[string]interface{}
	status, err := c.doRequest(ctx, http.MethodGet, path, nil, &res)
	if err == nil && status == http.StatusOK {
		return nil
	}

	// Create KVM
	createPath := fmt.Sprintf("/environments/%s/keyvaluemaps", url.PathEscape(env))
	createBody := map[string]interface{}{
		"name":      kvmName,
		"encrypted": false,
	}
	_, err = c.doRequest(ctx, http.MethodPost, createPath, createBody, nil)
	if err != nil && !strings.Contains(err.Error(), "already exists") {
		return fmt.Errorf("failed to create kvm %s in env %s: %w", kvmName, env, err)
	}
	return nil
}

// KVMEntry represents an entry in an Apigee KeyValueMap.
type KVMEntry struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// GetKVMEntry retrieves a single KVM entry value.
func (c *ApigeeClient) GetKVMEntry(ctx context.Context, env, kvmName, entryName string) (string, error) {
	path := fmt.Sprintf("/environments/%s/keyvaluemaps/%s/entries/%s",
		url.PathEscape(env), url.PathEscape(kvmName), url.PathEscape(entryName))
	var entry KVMEntry
	_, err := c.doRequest(ctx, http.MethodGet, path, nil, &entry)
	if err != nil {
		return "", err
	}
	return entry.Value, nil
}

// SaveKVMEntry creates or updates an entry in the specified KVM.
func (c *ApigeeClient) SaveKVMEntry(ctx context.Context, env, kvmName, entryName, value string) error {
	if err := c.EnsureKVM(ctx, env, kvmName); err != nil {
		return err
	}

	entryBody := KVMEntry{
		Name:  entryName,
		Value: value,
	}

	// Try PUT first to update existing entry
	putPath := fmt.Sprintf("/environments/%s/keyvaluemaps/%s/entries/%s",
		url.PathEscape(env), url.PathEscape(kvmName), url.PathEscape(entryName))
	status, err := c.doRequest(ctx, http.MethodPut, putPath, entryBody, nil)
	if err == nil && (status == http.StatusOK || status == http.StatusNoContent) {
		return nil
	}

	// If entry didn't exist (404), create it via POST
	postPath := fmt.Sprintf("/environments/%s/keyvaluemaps/%s/entries",
		url.PathEscape(env), url.PathEscape(kvmName))
	_, err = c.doRequest(ctx, http.MethodPost, postPath, entryBody, nil)
	if err != nil {
		return fmt.Errorf("save kvm entry failed: %w", err)
	}
	return nil
}

// APIProduct models an Apigee API Product with LLM operation group details.
type APIProduct struct {
	Name                  string                 `json:"name"`
	DisplayName           string                 `json:"displayName,omitempty"`
	Description           string                 `json:"description,omitempty"`
	ApprovalType          string                 `json:"approvalType,omitempty"`
	Attributes            []ProductAttribute     `json:"attributes,omitempty"`
	Environments          []string               `json:"environments,omitempty"`
	Proxies               []string               `json:"proxies,omitempty"`
	Quota                 string                 `json:"quota,omitempty"`
	QuotaInterval         string                 `json:"quotaInterval,omitempty"`
	QuotaTimeUnit         string                 `json:"quotaTimeUnit,omitempty"`
	CreatedAt             string                 `json:"createdAt,omitempty"`
	LastModifiedAt        string                 `json:"lastModifiedAt,omitempty"`
	OperationGroup        *OperationGroup        `json:"operationGroup,omitempty"`
	LlmOperationGroup     *LlmOperationGroup     `json:"llmOperationGroup,omitempty"`
	PayloadOperationGroup map[string]interface{} `json:"payloadOperationGroup,omitempty"`
}

type ProductAttribute struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type OperationGroup struct {
	OperationConfigs     []OperationConfig `json:"operationConfigs,omitempty"`
	OperationConfigType  string            `json:"operationConfigType,omitempty"`
}

type OperationConfig struct {
	APISource  string            `json:"apiSource"`
	Operations []OperationDetail `json:"operations"`
	Quota      *QuotaDetail      `json:"quota,omitempty"`
}

type OperationDetail struct {
	Resource string   `json:"resource"`
	Methods  []string `json:"methods,omitempty"`
}

type QuotaDetail struct {
	Limit    string `json:"limit,omitempty"`
	Interval string `json:"interval,omitempty"`
	TimeUnit string `json:"timeUnit,omitempty"`
}

type LlmOperationGroup struct {
	OperationConfigs []LlmOperationConfig `json:"operationConfigs,omitempty"`
}

type LlmOperationConfig struct {
	APISource     string            `json:"apiSource"`
	LlmOperations []LlmOpDetail     `json:"llmOperations"`
	LlmTokenQuota *LlmTokenQuota    `json:"llmTokenQuota,omitempty"`
}

type LlmOpDetail struct {
	Resource string   `json:"resource"`
	Model    string   `json:"model"`
	Methods  []string `json:"methods,omitempty"`
}

type LlmTokenQuota struct {
	Limit    string `json:"limit,omitempty"`
	Interval string `json:"interval,omitempty"`
	TimeUnit string `json:"timeUnit,omitempty"`
}

type ProductsListResponse struct {
	APIProduct []APIProduct `json:"apiProduct"`
}

// GetProducts retrieves all products (with expand=true).
func (c *ApigeeClient) GetProducts(ctx context.Context) ([]APIProduct, error) {
	var resp ProductsListResponse
	_, err := c.doRequest(ctx, http.MethodGet, "/apiproducts?expand=true", nil, &resp)
	if err != nil {
		// If expand fails, fallback to simple list
		var names []string
		_, err2 := c.doRequest(ctx, http.MethodGet, "/apiproducts", nil, &names)
		if err2 != nil {
			return nil, err
		}
		var products []APIProduct
		for _, name := range names {
			prod, errProd := c.GetProduct(ctx, name)
			if errProd == nil && prod != nil {
				products = append(products, *prod)
			}
		}
		return products, nil
	}
	return resp.APIProduct, nil
}

// GetProduct retrieves a single product by name.
func (c *ApigeeClient) GetProduct(ctx context.Context, name string) (*APIProduct, error) {
	path := fmt.Sprintf("/apiproducts/%s", url.PathEscape(name))
	var product APIProduct
	_, err := c.doRequest(ctx, http.MethodGet, path, nil, &product)
	if err != nil {
		return nil, err
	}
	return &product, nil
}

// CreateProduct creates a new API product.
func (c *ApigeeClient) CreateProduct(ctx context.Context, product *APIProduct) error {
	_, err := c.doRequest(ctx, http.MethodPost, "/apiproducts", product, nil)
	return err
}

// UpdateProduct updates an existing API product.
func (c *ApigeeClient) UpdateProduct(ctx context.Context, name string, product *APIProduct) error {
	path := fmt.Sprintf("/apiproducts/%s", url.PathEscape(name))
	_, err := c.doRequest(ctx, http.MethodPut, path, product, nil)
	return err
}

// DeleteProduct deletes an API product.
func (c *ApigeeClient) DeleteProduct(ctx context.Context, name string) error {
	path := fmt.Sprintf("/apiproducts/%s", url.PathEscape(name))
	_, err := c.doRequest(ctx, http.MethodDelete, path, nil, nil)
	return err
}

// DataCollector models an Apigee Data Collector definition.
type DataCollector struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Type        string `json:"type"`
}

type DataCollectorsResponse struct {
	DataCollectors []DataCollector `json:"dataCollectors"`
}

// GetDataCollectors lists all data collectors configured in the organization.
func (c *ApigeeClient) GetDataCollectors(ctx context.Context) ([]DataCollector, error) {
	var resp DataCollectorsResponse
	_, err := c.doRequest(ctx, http.MethodGet, "/datacollectors", nil, &resp)
	if err != nil {
		return nil, err
	}
	return resp.DataCollectors, nil
}

// StatsResponse models the Apigee Stats API response structure.
type StatsResponse struct {
	Environments []StatsEnvironment `json:"environments"`
	MetaData     map[string]interface{} `json:"metaData,omitempty"`
}

type StatsEnvironment struct {
	Name       string           `json:"name"`
	Dimensions []StatsDimension `json:"dimensions,omitempty"`
	Metrics    []StatsMetric    `json:"metrics,omitempty"`
}

type StatsDimension struct {
	Name            string        `json:"name"`
	Metrics         []StatsMetric `json:"metrics"`
	IndividualNames []string      `json:"individualNames,omitempty"`
}

type StatsMetric struct {
	Name   string        `json:"name"`
	Values []interface{} `json:"values"`
}

// QueryStats queries the Apigee Analytics Stats API.
func (c *ApigeeClient) QueryStats(ctx context.Context, env, dimension, selectMetrics, timeRange, timeUnit, filter string) (*StatsResponse, error) {
	v := url.Values{}
	if selectMetrics != "" {
		v.Set("select", selectMetrics)
	}
	if timeRange != "" {
		v.Set("timeRange", timeRange)
	}
	if timeUnit != "" {
		v.Set("timeUnit", timeUnit)
	}
	if filter != "" {
		v.Set("filter", filter)
	}

	var path string
	if dimension != "" {
		path = fmt.Sprintf("/environments/%s/stats/%s?%s",
			url.PathEscape(env), url.PathEscape(dimension), v.Encode())
	} else {
		path = fmt.Sprintf("/environments/%s/stats?%s",
			url.PathEscape(env), v.Encode())
	}

	var resp StatsResponse
	_, err := c.doRequest(ctx, http.MethodGet, path, nil, &resp)
	if err != nil {
		return nil, err
	}
	return &resp, nil
}

// Developer models an Apigee Developer entity.
type Developer struct {
	DeveloperID      string   `json:"developerId,omitempty"`
	Email            string   `json:"email"`
	FirstName        string   `json:"firstName,omitempty"`
	LastName         string   `json:"lastName,omitempty"`
	UserName         string   `json:"userName,omitempty"`
	OrganizationName string   `json:"organizationName,omitempty"`
	Status           string   `json:"status,omitempty"`
	Apps             []string `json:"apps,omitempty"`
	CreatedAt        string   `json:"createdAt,omitempty"`
	LastModifiedAt   string   `json:"lastModifiedAt,omitempty"`

	// Enriched analytics fields
	TotalSpend  float64 `json:"totalSpend"`
	TotalTokens int64   `json:"totalTokens"`
	TotalCalls  int64   `json:"totalCalls"`
}

type DevelopersListResponse struct {
	Developer []Developer `json:"developer"`
}

type DeveloperApp struct {
	AppID          string             `json:"appId,omitempty"`
	Name           string             `json:"name"`
	DeveloperID    string             `json:"developerId,omitempty"`
	Status         string             `json:"status,omitempty"`
	AppFamily      string             `json:"appFamily,omitempty"`
	CreatedAt      string             `json:"createdAt,omitempty"`
	LastModifiedAt string             `json:"lastModifiedAt,omitempty"`
	Credentials    []AppCredential    `json:"credentials,omitempty"`
	Attributes     []ProductAttribute `json:"attributes,omitempty"`

	// Enriched analytics fields
	TotalSpend  float64 `json:"totalSpend"`
	TotalTokens int64   `json:"totalTokens"`
	TotalCalls  int64   `json:"totalCalls"`
}

type AppCredential struct {
	ConsumerKey    string              `json:"consumerKey"`
	ConsumerSecret string              `json:"consumerSecret"`
	Status         string              `json:"status,omitempty"`
	IssuedAt       string              `json:"issuedAt,omitempty"`
	ExpiresAt      string              `json:"expiresAt,omitempty"`
	APIProducts    []CredentialProduct `json:"apiProducts,omitempty"`

	// Enriched analytics fields
	TotalSpend  float64 `json:"totalSpend"`
	TotalTokens int64   `json:"totalTokens"`
	TotalCalls  int64   `json:"totalCalls"`
}

type CredentialProduct struct {
	Apiproduct string `json:"apiproduct"`
	Status     string `json:"status,omitempty"`
}

type DeveloperAppsResponse struct {
	App []DeveloperApp `json:"app"`
}

// GetDevelopers retrieves developers with optional pagination and expansion.
func (c *ApigeeClient) GetDevelopers(ctx context.Context, count int, startKey string, expand bool) ([]Developer, error) {
	v := url.Values{}
	if count > 0 {
		v.Set("count", strconv.Itoa(count))
	}
	if startKey != "" {
		v.Set("startKey", startKey)
	}
	if expand {
		v.Set("expand", "true")
	}

	path := fmt.Sprintf("/developers?%s", v.Encode())
	var resp DevelopersListResponse
	_, err := c.doRequest(ctx, http.MethodGet, path, nil, &resp)
	if err != nil {
		return nil, err
	}
	return resp.Developer, nil
}

// GetDeveloper retrieves a single developer by email.
func (c *ApigeeClient) GetDeveloper(ctx context.Context, email string) (*Developer, error) {
	path := fmt.Sprintf("/developers/%s", url.PathEscape(email))
	var dev Developer
	_, err := c.doRequest(ctx, http.MethodGet, path, nil, &dev)
	if err != nil {
		return nil, err
	}
	return &dev, nil
}

// CreateDeveloper registers a new developer.
func (c *ApigeeClient) CreateDeveloper(ctx context.Context, dev *Developer) error {
	_, err := c.doRequest(ctx, http.MethodPost, "/developers", dev, nil)
	return err
}

// UpdateDeveloper updates developer attributes.
func (c *ApigeeClient) UpdateDeveloper(ctx context.Context, email string, dev *Developer) error {
	path := fmt.Sprintf("/developers/%s", url.PathEscape(email))
	_, err := c.doRequest(ctx, http.MethodPut, path, dev, nil)
	return err
}

// DeleteDeveloper removes a developer.
func (c *ApigeeClient) DeleteDeveloper(ctx context.Context, email string) error {
	path := fmt.Sprintf("/developers/%s", url.PathEscape(email))
	_, err := c.doRequest(ctx, http.MethodDelete, path, nil, nil)
	return err
}

// GetDeveloperApps retrieves all apps for a specific developer.
func (c *ApigeeClient) GetDeveloperApps(ctx context.Context, email string) ([]DeveloperApp, error) {
	path := fmt.Sprintf("/developers/%s/apps?expand=true", url.PathEscape(email))
	var resp DeveloperAppsResponse
	_, err := c.doRequest(ctx, http.MethodGet, path, nil, &resp)
	if err != nil {
		// If 404 or empty, return empty list
		return nil, err
	}
	return resp.App, nil
}

// GetDeveloperApp gets details of a single developer app.
func (c *ApigeeClient) GetDeveloperApp(ctx context.Context, email, appName string) (*DeveloperApp, error) {
	path := fmt.Sprintf("/developers/%s/apps/%s", url.PathEscape(email), url.PathEscape(appName))
	var app DeveloperApp
	_, err := c.doRequest(ctx, http.MethodGet, path, nil, &app)
	if err != nil {
		return nil, err
	}
	return &app, nil
}

// CreateDeveloperApp creates an app for a developer with product subscriptions.
func (c *ApigeeClient) CreateDeveloperApp(ctx context.Context, email, appName string, apiProducts []string) error {
	path := fmt.Sprintf("/developers/%s/apps", url.PathEscape(email))
	body := map[string]interface{}{
		"name":        appName,
		"apiProducts": apiProducts,
	}
	_, err := c.doRequest(ctx, http.MethodPost, path, body, nil)
	return err
}

// DeleteDeveloperApp removes an app from a developer.
func (c *ApigeeClient) DeleteDeveloperApp(ctx context.Context, email, appName string) error {
	path := fmt.Sprintf("/developers/%s/apps/%s", url.PathEscape(email), url.PathEscape(appName))
	_, err := c.doRequest(ctx, http.MethodDelete, path, nil, nil)
	return err
}

// CreateAppCredentialKey generates a new key/secret pair for an app.
func (c *ApigeeClient) CreateAppCredentialKey(ctx context.Context, email, appName string, apiProducts []string) error {
	path := fmt.Sprintf("/developers/%s/apps/%s/keys/create", url.PathEscape(email), url.PathEscape(appName))
	body := map[string]interface{}{
		"apiProducts": apiProducts,
	}
	_, err := c.doRequest(ctx, http.MethodPost, path, body, nil)
	return err
}

// AddProductsToKey associates one or more API products with an existing credential key.
func (c *ApigeeClient) AddProductsToKey(ctx context.Context, email, appName, key string, apiProducts []string) error {
	path := fmt.Sprintf("/developers/%s/apps/%s/keys/%s", url.PathEscape(email), url.PathEscape(appName), url.PathEscape(key))
	body := map[string]interface{}{
		"apiProducts": apiProducts,
	}
	_, err := c.doRequest(ctx, http.MethodPost, path, body, nil)
	return err
}

// RemoveProductFromKey removes an API product subscription from a credential key.
func (c *ApigeeClient) RemoveProductFromKey(ctx context.Context, email, appName, key, product string) error {
	path := fmt.Sprintf("/developers/%s/apps/%s/keys/%s/apiproducts/%s",
		url.PathEscape(email), url.PathEscape(appName), url.PathEscape(key), url.PathEscape(product))
	_, err := c.doRequest(ctx, http.MethodDelete, path, nil, nil)
	return err
}

// DeleteAppCredentialKey revokes and removes a consumer key.
func (c *ApigeeClient) DeleteAppCredentialKey(ctx context.Context, email, appName, key string) error {
	path := fmt.Sprintf("/developers/%s/apps/%s/keys/%s",
		url.PathEscape(email), url.PathEscape(appName), url.PathEscape(key))
	_, err := c.doRequest(ctx, http.MethodDelete, path, nil, nil)
	return err
}
