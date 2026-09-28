package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

// Server holds application state and HTTP routing.
type Server struct {
	client *ApigeeClient
}

// writeJSON sends a JSON response with status code.
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

// writeError sends a JSON error response.
func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{
		"error": message,
	})
}

// HealthHandler handles health check requests.
func (s *Server) HealthHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":    "ok",
		"project":   s.client.GetProjectID(),
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

// ConfigHandler returns organization configuration and environments.
func (s *Server) ConfigHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	envs, err := s.client.GetEnvironments(ctx)
	if err != nil {
		log.Printf("Error fetching environments: %v", err)
		envs = []string{"dev"} // graceful fallback
	}

	collectors, err := s.client.GetDataCollectors(ctx)
	if err != nil {
		log.Printf("Warning: fetching datacollectors: %v", err)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"project":        s.client.GetProjectID(),
		"environments":   envs,
		"dataCollectors": collectors,
	})
}

// EnvironmentsHandler returns the list of Apigee environments.
func (s *Server) EnvironmentsHandler(w http.ResponseWriter, r *http.Request) {
	envs, err := s.client.GetEnvironments(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, envs)
}

// PricesGetHandler retrieves the model prices from KVM AI-Config.PriceList.
func (s *Server) PricesGetHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	env := r.URL.Query().Get("env")
	if env == "" {
		envs, err := s.client.GetEnvironments(ctx)
		if err == nil && len(envs) > 0 {
			env = envs[0]
		} else {
			env = "dev"
		}
	}

	val, err := s.client.GetKVMEntry(ctx, env, "AI-Config", "PriceList")
	if err != nil {
		// Not found or not created yet
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"environment": env,
			"exists":      false,
			"prices":      DefaultPriceList(),
			"raw":         "",
		})
		return
	}

	prices, err := ParsePriceList(val)
	if err != nil {
		// If unmarshal fails, return raw string along with default
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"environment": env,
			"exists":      true,
			"error":       fmt.Sprintf("Invalid JSON in KVM: %v", err),
			"prices":      DefaultPriceList(),
			"raw":         val,
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"environment": env,
		"exists":      true,
		"prices":      prices,
		"raw":         val,
	})
}

// PriceSaveRequest represents the payload to save prices.
type PriceSaveRequest struct {
	Environments []string  `json:"environments"`
	Prices       PriceList `json:"prices"`
}

// PricesSaveHandler saves model prices to KVM AI-Config.PriceList for selected environments.
func (s *Server) PricesSaveHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req PriceSaveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body: "+err.Error())
		return
	}

	if len(req.Prices) == 0 {
		writeError(w, http.StatusBadRequest, "Prices map cannot be empty")
		return
	}

	// Ensure "default" price entry exists
	if _, ok := req.Prices["default"]; !ok {
		req.Prices["default"] = ModelPrice{
			RequestPerMillionTokens:  1.0,
			ResponsePerMillionTokens: 3.0,
		}
	}

	priceJSON, err := json.Marshal(req.Prices)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Marshal prices: "+err.Error())
		return
	}

	allEnvs, _ := s.client.GetEnvironments(ctx)
	targetEnvs := req.Environments
	if len(targetEnvs) == 0 || (len(targetEnvs) == 1 && targetEnvs[0] == "all") {
		targetEnvs = allEnvs
	}

	type ResultItem struct {
		Environment string `json:"environment"`
		Status      string `json:"status"`
		Error       string `json:"error,omitempty"`
	}

	var results []ResultItem
	for _, env := range targetEnvs {
		if strings.TrimSpace(env) == "" {
			continue
		}
		saveErr := s.client.SaveKVMEntry(ctx, env, "AI-Config", "PriceList", string(priceJSON))
		if saveErr != nil {
			results = append(results, ResultItem{
				Environment: env,
				Status:      "error",
				Error:       saveErr.Error(),
			})
		} else {
			results = append(results, ResultItem{
				Environment: env,
				Status:      "success",
			})
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"results": results,
		"prices":  req.Prices,
	})
}

// PriceLoadDefaultsRequest represents the payload for loading default prices.
type PriceLoadDefaultsRequest struct {
	Environments []string `json:"environments"`
}

// PricesDefaultsGetHandler returns the default list price data without persisting.
func (s *Server) PricesDefaultsGetHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"prices": DefaultPriceList(),
	})
}

// PricesLoadDefaultsHandler loads default list price data and saves it into KVM AI-Config.PriceList.
func (s *Server) PricesLoadDefaultsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req PriceLoadDefaultsRequest
	if r.Body != nil && r.ContentLength > 0 {
		_ = json.NewDecoder(r.Body).Decode(&req)
	}

	targetEnvs := req.Environments
	if len(targetEnvs) == 0 {
		if envParam := r.URL.Query().Get("env"); envParam != "" {
			targetEnvs = []string{envParam}
		}
	}

	allEnvs, _ := s.client.GetEnvironments(ctx)
	if len(targetEnvs) == 0 || (len(targetEnvs) == 1 && targetEnvs[0] == "all") {
		if len(allEnvs) > 0 {
			targetEnvs = allEnvs
		} else {
			targetEnvs = []string{"dev"}
		}
	}

	defaultPrices := DefaultPriceList()
	priceJSON, err := json.Marshal(defaultPrices)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Marshal default prices: "+err.Error())
		return
	}

	type ResultItem struct {
		Environment string `json:"environment"`
		Status      string `json:"status"`
		Error       string `json:"error,omitempty"`
	}

	var results []ResultItem
	for _, env := range targetEnvs {
		if strings.TrimSpace(env) == "" {
			continue
		}
		saveErr := s.client.SaveKVMEntry(ctx, env, "AI-Config", "PriceList", string(priceJSON))
		if saveErr != nil {
			results = append(results, ResultItem{
				Environment: env,
				Status:      "error",
				Error:       saveErr.Error(),
			})
		} else {
			results = append(results, ResultItem{
				Environment: env,
				Status:      "success",
			})
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":      "Default price list saved to KVM AI-Config.PriceList",
		"results":      results,
		"prices":       defaultPrices,
		"environments": targetEnvs,
	})
}

// EnhancedProduct decorates APIProduct with budget metrics.
type EnhancedProduct struct {
	APIProduct
	IsAIProduct           bool                `json:"isAIProduct"`
	ModelBudgets          []ModelBudgetDetail `json:"modelBudgets,omitempty"`
	TotalMonthlyBudgetUSD float64             `json:"totalMonthlyBudgetUSD"`
	TotalMonthlyTokens    int64               `json:"totalMonthlyTokens"`
}

type ModelBudgetDetail struct {
	Model         string     `json:"model"`
	APISource     string     `json:"apiSource"`
	Resource      string     `json:"resource"`
	Methods       []string   `json:"methods"`
	TokenLimit    int64      `json:"tokenLimit"`
	EstimatedUSD  float64    `json:"estimatedUSD"`
	BlendedRate   float64    `json:"blendedRate"`
	Interval      string     `json:"interval"`
	TimeUnit      string     `json:"timeUnit"`
	ModelPricing  ModelPrice `json:"modelPricing"`
}

// ProductsHandler lists products and decorates with AI model budgets.
func (s *Server) ProductsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	env := r.URL.Query().Get("env")
	if env == "" {
		envs, _ := s.client.GetEnvironments(ctx)
		if len(envs) > 0 {
			env = envs[0]
		} else {
			env = "dev"
		}
	}

	// Fetch price list for conversion
	var prices PriceList
	val, err := s.client.GetKVMEntry(ctx, env, "AI-Config", "PriceList")
	if err == nil {
		prices, _ = ParsePriceList(val)
	}
	if prices == nil {
		prices = DefaultPriceList()
	}

	products, err := s.client.GetProducts(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var enhanced []EnhancedProduct
	for _, p := range products {
		ep := EnhancedProduct{
			APIProduct: p,
		}

		if p.LlmOperationGroup != nil && len(p.LlmOperationGroup.OperationConfigs) > 0 {
			ep.IsAIProduct = true
			for _, cfg := range p.LlmOperationGroup.OperationConfigs {
				tokenLimit := int64(0)
				interval := "1"
				timeUnit := "month"
				if cfg.LlmTokenQuota != nil {
					if l, parseErr := strconv.ParseInt(cfg.LlmTokenQuota.Limit, 10, 64); parseErr == nil {
						tokenLimit = l
					}
					if cfg.LlmTokenQuota.Interval != "" {
						interval = cfg.LlmTokenQuota.Interval
					}
					if cfg.LlmTokenQuota.TimeUnit != "" {
						timeUnit = cfg.LlmTokenQuota.TimeUnit
					}
				}

				for _, op := range cfg.LlmOperations {
					modelName := op.Model
					if modelName == "" {
						modelName = "default"
					}
					estUSD, blended := ConvertTokensToMoney(modelName, tokenLimit, prices, 0.75)
					ep.ModelBudgets = append(ep.ModelBudgets, ModelBudgetDetail{
						Model:        modelName,
						APISource:    cfg.APISource,
						Resource:     op.Resource,
						Methods:      op.Methods,
						TokenLimit:   tokenLimit,
						EstimatedUSD: estUSD,
						BlendedRate:  blended,
						Interval:     interval,
						TimeUnit:     timeUnit,
						ModelPricing: prices.GetEffectivePrice(modelName),
					})
				}
			}

			var totalMonthlyUSD float64
			var totalMonthlyTokens float64
			for _, mb := range ep.ModelBudgets {
				intv, _ := strconv.ParseFloat(mb.Interval, 64)
				if intv <= 0 {
					intv = 1.0
				}
				mult := 1.0 / intv
				switch strings.ToLower(mb.TimeUnit) {
				case "day":
					mult = 30.0 / intv
				case "hour":
					mult = (30.0 * 24.0) / intv
				case "minute":
					mult = (30.0 * 24.0 * 60.0) / intv
				case "month":
					mult = 1.0 / intv
				}
				totalMonthlyUSD += mb.EstimatedUSD * mult
				totalMonthlyTokens += float64(mb.TokenLimit) * mult
			}
			ep.TotalMonthlyBudgetUSD = math.Round(totalMonthlyUSD*100) / 100
			ep.TotalMonthlyTokens = int64(math.Round(totalMonthlyTokens))
		}

		enhanced = append(enhanced, ep)
	}

	writeJSON(w, http.StatusOK, enhanced)
}

// ProductGetHandler retrieves a single product by name.
func (s *Server) ProductGetHandler(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/api/products/")
	if name == "" {
		writeError(w, http.StatusBadRequest, "Missing product name")
		return
	}

	prod, err := s.client.GetProduct(r.Context(), name)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, prod)
}

// ProductCreateHandler creates a new product.
func (s *Server) ProductCreateHandler(w http.ResponseWriter, r *http.Request) {
	var prod APIProduct
	if err := json.NewDecoder(r.Body).Decode(&prod); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid body: "+err.Error())
		return
	}

	if prod.Name == "" {
		writeError(w, http.StatusBadRequest, "Product name is required")
		return
	}

	if err := s.client.CreateProduct(r.Context(), &prod); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, prod)
}

// ProductUpdateHandler updates an existing product.
func (s *Server) ProductUpdateHandler(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/api/products/")
	if name == "" {
		writeError(w, http.StatusBadRequest, "Missing product name")
		return
	}

	var prod APIProduct
	if err := json.NewDecoder(r.Body).Decode(&prod); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid body: "+err.Error())
		return
	}

	if err := s.client.UpdateProduct(r.Context(), name, &prod); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, prod)
}

// ProductDeleteHandler deletes a product.
func (s *Server) ProductDeleteHandler(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/api/products/")
	if name == "" {
		writeError(w, http.StatusBadRequest, "Missing product name")
		return
	}

	if err := s.client.DeleteProduct(r.Context(), name); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted", "name": name})
}

// UpdateModelBudgetPayload models request to update LLM model quotas on a product.
type UpdateModelBudgetPayload struct {
	Environment          string              `json:"environment"`
	DeployToEnvironments []string            `json:"deployToEnvironments"`
	Models               []ModelBudgetDetail `json:"models"`
}

// ProductBudgetHandler handles easy editing of LLM model quotas in tokens or money.
func (s *Server) ProductBudgetHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	name := strings.TrimPrefix(r.URL.Path, "/api/products/")
	name = strings.TrimSuffix(name, "/budget")

	var req UpdateModelBudgetPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid body: "+err.Error())
		return
	}

	if len(req.Models) == 0 {
		writeError(w, http.StatusBadRequest, "Cannot update budgets: no models specified in request. To avoid unintended data loss, at least one model quota must be provided.")
		return
	}

	// Fetch existing product
	prod, err := s.client.GetProduct(ctx, name)
	if err != nil {
		writeError(w, http.StatusNotFound, "Product not found: "+err.Error())
		return
	}

	// Fetch price list for conversions
	env := req.Environment
	if env == "" && len(prod.Environments) > 0 {
		env = prod.Environments[0]
	}
	if env == "" {
		env = "dev"
	}

	var prices PriceList
	val, err := s.client.GetKVMEntry(ctx, env, "AI-Config", "PriceList")
	if err == nil {
		prices, _ = ParsePriceList(val)
	}
	if prices == nil {
		prices = DefaultPriceList()
	}

	// Build updated LlmOperationGroup
	var opConfigs []LlmOperationConfig
	for _, m := range req.Models {
		tokenLimit := m.TokenLimit
		// If user entered EstimatedUSD and no TokenLimit (or tokenLimit == 0), convert money to tokens
		if tokenLimit <= 0 && m.EstimatedUSD > 0 {
			tokenLimit, _ = ConvertMoneyToTokens(m.Model, m.EstimatedUSD, prices, 0.75)
		}

		apiSource := m.APISource
		if apiSource == "" {
			apiSource = "REST-AI-Completions"
		}
		resource := m.Resource
		if resource == "" {
			resource = "/"
		}
		methods := m.Methods
		if len(methods) == 0 {
			methods = []string{"POST"}
		}
		interval := m.Interval
		if interval == "" {
			interval = "1"
		}
		timeUnit := m.TimeUnit
		if timeUnit == "" {
			timeUnit = "month"
		}

		opConfigs = append(opConfigs, LlmOperationConfig{
			APISource: apiSource,
			LlmOperations: []LlmOpDetail{
				{
					Model:    m.Model,
					Resource: resource,
					Methods:  methods,
				},
			},
			LlmTokenQuota: &LlmTokenQuota{
				Limit:    strconv.FormatInt(tokenLimit, 10),
				Interval: interval,
				TimeUnit: timeUnit,
			},
		})
	}

	prod.LlmOperationGroup = &LlmOperationGroup{
		OperationConfigs: opConfigs,
	}

	if len(req.DeployToEnvironments) > 0 {
		prod.Environments = req.DeployToEnvironments
	}

	if err := s.client.UpdateProduct(ctx, name, prod); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update product: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":  "success",
		"product": prod,
	})
}

// ConvertBudgetHandler provides dynamic bidirectional calculation between tokens and money.
func (s *Server) ConvertBudgetHandler(w http.ResponseWriter, r *http.Request) {
	type ConvertRequest struct {
		Environment string  `json:"environment"`
		Model       string  `json:"model"`
		TokenLimit  int64   `json:"tokenLimit"`
		BudgetUSD   float64 `json:"budgetUSD"`
		PromptRatio float64 `json:"promptRatio"`
	}

	var req ConvertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid body: "+err.Error())
		return
	}

	ctx := r.Context()
	env := req.Environment
	if env == "" {
		env = "dev"
	}

	var prices PriceList
	val, err := s.client.GetKVMEntry(ctx, env, "AI-Config", "PriceList")
	if err == nil {
		prices, _ = ParsePriceList(val)
	}
	if prices == nil {
		prices = DefaultPriceList()
	}

	ratio := req.PromptRatio
	if ratio <= 0 || ratio >= 1 {
		ratio = 0.75
	}

	modelName := req.Model
	if modelName == "" {
		modelName = "default"
	}

	var calculatedUSD float64
	var calculatedTokens int64
	var blended float64

	if req.BudgetUSD > 0 {
		calculatedTokens, blended = ConvertMoneyToTokens(modelName, req.BudgetUSD, prices, ratio)
		calculatedUSD = req.BudgetUSD
	} else {
		calculatedUSD, blended = ConvertTokensToMoney(modelName, req.TokenLimit, prices, ratio)
		calculatedTokens = req.TokenLimit
	}

	effPrice := prices.GetEffectivePrice(modelName)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"model":            modelName,
		"tokenLimit":       calculatedTokens,
		"budgetUSD":        calculatedUSD,
		"blendedRatePerM":  blended,
		"promptRatio":      ratio,
		"effectivePricing": effPrice,
	})
}

// AnalyticsOverviewHandler returns aggregated analytics KPI data.
func (s *Server) AnalyticsOverviewHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	env := r.URL.Query().Get("env")
	if env == "" {
		envs, _ := s.client.GetEnvironments(ctx)
		if len(envs) > 0 {
			env = envs[0]
		} else {
			env = "dev"
		}
	}

	timeRange := r.URL.Query().Get("timeRange")
	if timeRange == "" {
		// Default to current month / last 30 days
		now := time.Now().UTC()
		start := now.AddDate(0, 0, -30)
		timeRange = fmt.Sprintf("%s~%s", start.Format("01/02/2006 15:04"), now.Format("01/02/2006 15:04"))
	}

	// Query breakdown by model
	selectMetrics := "sum(dc_ai_total_token_count),sum(dc_ai_prompt_token_count),sum(dc_ai_response_token_count),sum(dc_ai_total_cost),sum(dc_ai_request_cost),sum(dc_ai_response_cost),avg(dc_ai_time_first_token),message_count"
	modelStats, err := s.client.QueryStats(ctx, env, "dc_ai_model", selectMetrics, timeRange, "", "")

	totalTokens := int64(0)
	promptTokens := int64(0)
	responseTokens := int64(0)
	totalCost := float64(0)
	requestCost := float64(0)
	responseCost := float64(0)
	totalMessages := int64(0)
	weightedTTFT := float64(0)

	type ModelSummary struct {
		Model          string  `json:"model"`
		TotalTokens    int64   `json:"totalTokens"`
		PromptTokens   int64   `json:"promptTokens"`
		ResponseTokens int64   `json:"responseTokens"`
		TotalCost      float64 `json:"totalCost"`
		RequestCost    float64 `json:"requestCost"`
		ResponseCost   float64 `json:"responseCost"`
		AvgTTFT        float64 `json:"avgTTFT"`
		Calls          int64   `json:"calls"`
	}

	var models []ModelSummary

	if err == nil && modelStats != nil && len(modelStats.Environments) > 0 {
		for _, dim := range modelStats.Environments[0].Dimensions {
			mSummary := ModelSummary{
				Model: dim.Name,
			}
			for _, m := range dim.Metrics {
				valStr := ""
				if len(m.Values) > 0 && m.Values[0] != nil {
					valStr = fmt.Sprintf("%v", m.Values[0])
				}
				switch m.Name {
				case "sum(dc_ai_total_token_count)":
					tokens, _ := strconv.ParseInt(valStr, 10, 64)
					mSummary.TotalTokens = tokens
					totalTokens += tokens
				case "sum(dc_ai_prompt_token_count)":
					pTokens, _ := strconv.ParseInt(valStr, 10, 64)
					mSummary.PromptTokens = pTokens
					promptTokens += pTokens
				case "sum(dc_ai_response_token_count)":
					rTokens, _ := strconv.ParseInt(valStr, 10, 64)
					mSummary.ResponseTokens = rTokens
					responseTokens += rTokens
				case "sum(dc_ai_total_cost)":
					cost, _ := strconv.ParseFloat(valStr, 64)
					mSummary.TotalCost = cost
					totalCost += cost
				case "sum(dc_ai_request_cost)":
					rcost, _ := strconv.ParseFloat(valStr, 64)
					mSummary.RequestCost = rcost
					requestCost += rcost
				case "sum(dc_ai_response_cost)":
					respcost, _ := strconv.ParseFloat(valStr, 64)
					mSummary.ResponseCost = respcost
					responseCost += respcost
				case "avg(dc_ai_time_first_token)":
					ttft, _ := strconv.ParseFloat(valStr, 64)
					mSummary.AvgTTFT = ttft
				case "message_count":
					calls, _ := strconv.ParseInt(valStr, 10, 64)
					mSummary.Calls = calls
					totalMessages += calls
				}
			}

			if mSummary.Calls > 0 {
				weightedTTFT += mSummary.AvgTTFT * float64(mSummary.Calls)
			}
			models = append(models, mSummary)
		}
	}

	avgTTFT := float64(0)
	if totalMessages > 0 {
		avgTTFT = weightedTTFT / float64(totalMessages)
	}

	// Query streaming vs non-streaming
	respTypeStats, _ := s.client.QueryStats(ctx, env, "dc_ai_response_type", "sum(dc_ai_total_token_count),sum(dc_ai_total_cost),message_count", timeRange, "", "")
	type ResponseTypeSummary struct {
		Type        string  `json:"type"`
		TotalTokens int64   `json:"totalTokens"`
		TotalCost   float64 `json:"totalCost"`
		Calls       int64   `json:"calls"`
	}
	var respTypes []ResponseTypeSummary
	if respTypeStats != nil && len(respTypeStats.Environments) > 0 {
		for _, dim := range respTypeStats.Environments[0].Dimensions {
			rSummary := ResponseTypeSummary{Type: dim.Name}
			for _, m := range dim.Metrics {
				valStr := ""
				if len(m.Values) > 0 && m.Values[0] != nil {
					valStr = fmt.Sprintf("%v", m.Values[0])
				}
				switch m.Name {
				case "sum(dc_ai_total_token_count)":
					t, _ := strconv.ParseInt(valStr, 10, 64)
					rSummary.TotalTokens = t
				case "sum(dc_ai_total_cost)":
					c, _ := strconv.ParseFloat(valStr, 64)
					rSummary.TotalCost = c
				case "message_count":
					calls, _ := strconv.ParseInt(valStr, 10, 64)
					rSummary.Calls = calls
				}
			}
			respTypes = append(respTypes, rSummary)
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"environment":    env,
		"timeRange":      timeRange,
		"totalSpend":     math.Round(totalCost*10000) / 10000,
		"requestSpend":   math.Round(requestCost*10000) / 10000,
		"responseSpend":  math.Round(responseCost*10000) / 10000,
		"totalTokens":    totalTokens,
		"promptTokens":   promptTokens,
		"responseTokens": responseTokens,
		"totalCalls":     totalMessages,
		"avgLatencyMs":   math.Round(avgTTFT),
		"models":         models,
		"responseTypes":  respTypes,
	})
}

// AnalyticsBreakdownHandler queries stats for any specific dimension.
func (s *Server) AnalyticsBreakdownHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	env := r.URL.Query().Get("env")
	if env == "" {
		env = "dev"
	}
	dimension := r.URL.Query().Get("dimension")
	if dimension == "" {
		dimension = "dc_ai_model"
	}
	timeRange := r.URL.Query().Get("timeRange")
	if timeRange == "" {
		now := time.Now().UTC()
		start := now.AddDate(0, 0, -30)
		timeRange = fmt.Sprintf("%s~%s", start.Format("01/02/2006 15:04"), now.Format("01/02/2006 15:04"))
	}

	selectMetrics := "sum(dc_ai_total_token_count),sum(dc_ai_total_cost),avg(dc_ai_time_first_token),message_count"
	stats, err := s.client.QueryStats(ctx, env, dimension, selectMetrics, timeRange, "", "")
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	type BreakdownRow struct {
		Name        string  `json:"name"`
		TotalTokens int64   `json:"totalTokens"`
		TotalCost   float64 `json:"totalCost"`
		AvgTTFT     float64 `json:"avgTTFT"`
		Calls       int64   `json:"calls"`
	}

	var rows []BreakdownRow
	if len(stats.Environments) > 0 {
		for _, dim := range stats.Environments[0].Dimensions {
			row := BreakdownRow{Name: dim.Name}
			for _, m := range dim.Metrics {
				valStr := ""
				if len(m.Values) > 0 && m.Values[0] != nil {
					valStr = fmt.Sprintf("%v", m.Values[0])
				}
				switch m.Name {
				case "sum(dc_ai_total_token_count)":
					t, _ := strconv.ParseInt(valStr, 10, 64)
					row.TotalTokens = t
				case "sum(dc_ai_total_cost)":
					c, _ := strconv.ParseFloat(valStr, 64)
					row.TotalCost = c
				case "avg(dc_ai_time_first_token)":
					ttft, _ := strconv.ParseFloat(valStr, 64)
					row.AvgTTFT = ttft
				case "message_count":
					calls, _ := strconv.ParseInt(valStr, 10, 64)
					row.Calls = calls
				}
			}
			rows = append(rows, row)
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"dimension": dimension,
		"rows":      rows,
	})
}

// AnalyticsTimeSeriesHandler queries time series stats for timeline charts.
func (s *Server) AnalyticsTimeSeriesHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	env := r.URL.Query().Get("env")
	if env == "" {
		env = "dev"
	}
	timeUnit := r.URL.Query().Get("timeUnit")
	if timeUnit == "" {
		timeUnit = "day"
	}
	timeRange := r.URL.Query().Get("timeRange")
	if timeRange == "" {
		now := time.Now().UTC()
		start := now.AddDate(0, 0, -30)
		timeRange = fmt.Sprintf("%s~%s", start.Format("01/02/2006 15:04"), now.Format("01/02/2006 15:04"))
	}

	selectMetrics := "sum(dc_ai_total_token_count),sum(dc_ai_total_cost),message_count"
	stats, err := s.client.QueryStats(ctx, env, "", selectMetrics, timeRange, timeUnit, "")
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	type TimePoint struct {
		Timestamp int64   `json:"timestamp"`
		Tokens    int64   `json:"tokens"`
		Cost      float64 `json:"cost"`
		Calls     int64   `json:"calls"`
	}

	pointsMap := make(map[int64]*TimePoint)

	if len(stats.Environments) > 0 {
		for _, m := range stats.Environments[0].Metrics {
			for _, v := range m.Values {
				if vMap, ok := v.(map[string]interface{}); ok {
					var ts int64
					if rawTs, okTs := vMap["timestamp"].(float64); okTs {
						ts = int64(rawTs)
					}
					valStr := fmt.Sprintf("%v", vMap["value"])

					pt, exists := pointsMap[ts]
					if !exists {
						pt = &TimePoint{Timestamp: ts}
						pointsMap[ts] = pt
					}

					switch m.Name {
					case "sum(dc_ai_total_token_count)":
						tokens, _ := strconv.ParseInt(valStr, 10, 64)
						pt.Tokens = tokens
					case "sum(dc_ai_total_cost)":
						cost, _ := strconv.ParseFloat(valStr, 64)
						pt.Cost = cost
					case "message_count":
						calls, _ := strconv.ParseInt(valStr, 10, 64)
						pt.Calls = calls
					}
				}
			}
		}
	}

	var points []TimePoint
	for _, pt := range pointsMap {
		points = append(points, *pt)
	}

	writeJSON(w, http.StatusOK, points)
}

// DimensionMetrics holds aggregated analytics for a dimension value.
type DimensionMetrics struct {
	TotalSpend  float64 `json:"totalSpend"`
	TotalTokens int64   `json:"totalTokens"`
	TotalCalls  int64   `json:"totalCalls"`
}

// queryDimensionMetrics queries Apigee stats for an environment and dimension.
func (s *Server) queryDimensionMetrics(ctx context.Context, env, dimension, timeRange string) map[string]DimensionMetrics {
	result := make(map[string]DimensionMetrics)
	if env == "" {
		env = "dev"
	}
	if timeRange == "" {
		now := time.Now().UTC()
		start := now.AddDate(0, 0, -30)
		timeRange = fmt.Sprintf("%s~%s", start.Format("01/02/2006 15:04"), now.Format("01/02/2006 15:04"))
	}

	selectMetrics := "sum(dc_ai_total_cost),sum(dc_ai_total_token_count),message_count"
	stats, err := s.client.QueryStats(ctx, env, dimension, selectMetrics, timeRange, "", "")
	if err != nil || len(stats.Environments) == 0 {
		return result
	}

	for _, dim := range stats.Environments[0].Dimensions {
		name := dim.Name
		if name == "" || name == "(not set)" {
			continue
		}
		dm := DimensionMetrics{}
		for _, m := range dim.Metrics {
			valStr := ""
			if len(m.Values) > 0 && m.Values[0] != nil {
				valStr = fmt.Sprintf("%v", m.Values[0])
			}
			switch m.Name {
			case "sum(dc_ai_total_cost)":
				dm.TotalSpend, _ = strconv.ParseFloat(valStr, 64)
			case "sum(dc_ai_total_token_count)":
				f, _ := strconv.ParseFloat(valStr, 64)
				dm.TotalTokens = int64(f)
			case "message_count":
				f, _ := strconv.ParseFloat(valStr, 64)
				dm.TotalCalls = int64(f)
			}
		}
		dm.TotalSpend = math.Round(dm.TotalSpend*10000) / 10000
		result[name] = dm
	}
	return result
}

// DevelopersListHandler returns developers enriched with analytics usage data.
func (s *Server) DevelopersListHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	env := r.URL.Query().Get("env")
	if env == "" {
		envs, _ := s.client.GetEnvironments(ctx)
		if len(envs) > 0 {
			env = envs[0]
		} else {
			env = "dev"
		}
	}
	timeRange := r.URL.Query().Get("timeRange")

	// Fetch developers from Apigee
	devs, err := s.client.GetDevelopers(ctx, 1000, "", true)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to get developers: "+err.Error())
		return
	}

	// Fetch analytics by developer_email and dc_ai_user concurrently
	devMetricsChan := make(chan map[string]DimensionMetrics, 2)
	go func() {
		devMetricsChan <- s.queryDimensionMetrics(ctx, env, "developer_email", timeRange)
	}()
	go func() {
		devMetricsChan <- s.queryDimensionMetrics(ctx, env, "dc_ai_user", timeRange)
	}()

	m1 := <-devMetricsChan
	m2 := <-devMetricsChan

	// Merge metrics
	userMetrics := make(map[string]DimensionMetrics)
	for k, v := range m1 {
		userMetrics[k] = v
	}
	for k, v := range m2 {
		existing, ok := userMetrics[k]
		if ok {
			if v.TotalSpend > existing.TotalSpend {
				existing.TotalSpend = v.TotalSpend
			}
			if v.TotalTokens > existing.TotalTokens {
				existing.TotalTokens = v.TotalTokens
			}
			if v.TotalCalls > existing.TotalCalls {
				existing.TotalCalls = v.TotalCalls
			}
			userMetrics[k] = existing
		} else {
			userMetrics[k] = v
		}
	}

	totalSpend := float64(0)
	totalTokens := int64(0)
	totalApps := 0

	for i := range devs {
		email := devs[i].Email
		totalApps += len(devs[i].Apps)
		if m, ok := userMetrics[email]; ok {
			devs[i].TotalSpend = m.TotalSpend
			devs[i].TotalTokens = m.TotalTokens
			devs[i].TotalCalls = m.TotalCalls
			totalSpend += m.TotalSpend
			totalTokens += m.TotalTokens
		}
	}

	// Sort developers: those with traffic/spend first, then by apps count, then email
	sort.Slice(devs, func(i, j int) bool {
		if devs[i].TotalSpend != devs[j].TotalSpend {
			return devs[i].TotalSpend > devs[j].TotalSpend
		}
		if devs[i].TotalCalls != devs[j].TotalCalls {
			return devs[i].TotalCalls > devs[j].TotalCalls
		}
		if len(devs[i].Apps) != len(devs[j].Apps) {
			return len(devs[i].Apps) > len(devs[j].Apps)
		}
		return devs[i].Email < devs[j].Email
	})

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"developers":         devs,
		"totalDevelopers":    len(devs),
		"totalApps":          totalApps,
		"totalSpend":         math.Round(totalSpend*10000) / 10000,
		"totalTokens":        totalTokens,
		"environment":        env,
	})
}

// DeveloperCreateHandler creates a new developer.
func (s *Server) DeveloperCreateHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var dev Developer
	if err := json.NewDecoder(r.Body).Decode(&dev); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON: "+err.Error())
		return
	}

	if dev.Email == "" {
		writeError(w, http.StatusBadRequest, "Developer email is required")
		return
	}
	if dev.UserName == "" {
		dev.UserName = dev.Email
	}

	if err := s.client.CreateDeveloper(ctx, &dev); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create developer: "+err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, dev)
}

// DeveloperGetHandler retrieves a single developer.
func (s *Server) DeveloperGetHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	email := r.URL.Query().Get("email")
	if email == "" {
		writeError(w, http.StatusBadRequest, "Email is required")
		return
	}

	dev, err := s.client.GetDeveloper(ctx, email)
	if err != nil {
		writeError(w, http.StatusNotFound, "Developer not found: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, dev)
}

// DeveloperUpdateHandler updates developer details.
func (s *Server) DeveloperUpdateHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	email := r.URL.Query().Get("email")
	if email == "" {
		writeError(w, http.StatusBadRequest, "Email is required")
		return
	}

	var dev Developer
	if err := json.NewDecoder(r.Body).Decode(&dev); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON: "+err.Error())
		return
	}

	if err := s.client.UpdateDeveloper(ctx, email, &dev); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update developer: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, dev)
}

// DeveloperDeleteHandler deletes a developer.
func (s *Server) DeveloperDeleteHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	email := r.URL.Query().Get("email")
	if email == "" {
		writeError(w, http.StatusBadRequest, "Email is required")
		return
	}

	if err := s.client.DeleteDeveloper(ctx, email); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to delete developer: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Developer deleted successfully"})
}

// DeveloperAppsListHandler returns apps for a developer enriched with analytics per app and credential.
func (s *Server) DeveloperAppsListHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	email := r.URL.Query().Get("email")
	if email == "" {
		writeError(w, http.StatusBadRequest, "Email is required")
		return
	}
	env := r.URL.Query().Get("env")
	if env == "" {
		envs, _ := s.client.GetEnvironments(ctx)
		if len(envs) > 0 {
			env = envs[0]
		} else {
			env = "dev"
		}
	}
	timeRange := r.URL.Query().Get("timeRange")

	apps, err := s.client.GetDeveloperApps(ctx, email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to get developer apps: "+err.Error())
		return
	}

	// Concurrently query developer_app and client_id stats
	appStatsChan := make(chan map[string]DimensionMetrics, 1)
	keyStatsChan := make(chan map[string]DimensionMetrics, 1)

	go func() {
		appStatsChan <- s.queryDimensionMetrics(ctx, env, "developer_app", timeRange)
	}()
	go func() {
		keyStatsChan <- s.queryDimensionMetrics(ctx, env, "client_id", timeRange)
	}()

	appMetrics := <-appStatsChan
	keyMetrics := <-keyStatsChan

	totalSpend := float64(0)
	totalTokens := int64(0)

	for i := range apps {
		appName := apps[i].Name
		if m, ok := appMetrics[appName]; ok {
			apps[i].TotalSpend = m.TotalSpend
			apps[i].TotalTokens = m.TotalTokens
			apps[i].TotalCalls = m.TotalCalls
			totalSpend += m.TotalSpend
			totalTokens += m.TotalTokens
		}

		for j := range apps[i].Credentials {
			cKey := apps[i].Credentials[j].ConsumerKey
			if km, ok := keyMetrics[cKey]; ok {
				apps[i].Credentials[j].TotalSpend = km.TotalSpend
				apps[i].Credentials[j].TotalTokens = km.TotalTokens
				apps[i].Credentials[j].TotalCalls = km.TotalCalls
			}
		}

		// Sort credentials: those with spend first
		sort.Slice(apps[i].Credentials, func(a, b int) bool {
			if apps[i].Credentials[a].TotalSpend != apps[i].Credentials[b].TotalSpend {
				return apps[i].Credentials[a].TotalSpend > apps[i].Credentials[b].TotalSpend
			}
			return apps[i].Credentials[a].ConsumerKey < apps[i].Credentials[b].ConsumerKey
		})
	}

	sort.Slice(apps, func(i, j int) bool {
		if apps[i].TotalSpend != apps[j].TotalSpend {
			return apps[i].TotalSpend > apps[j].TotalSpend
		}
		return apps[i].Name < apps[j].Name
	})

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"email":       email,
		"apps":        apps,
		"totalSpend":  math.Round(totalSpend*10000) / 10000,
		"totalTokens": totalTokens,
	})
}

// DeveloperAppCreateHandler creates an app for a developer with product subscriptions.
func (s *Server) DeveloperAppCreateHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	email := r.URL.Query().Get("email")
	if email == "" {
		writeError(w, http.StatusBadRequest, "Email is required")
		return
	}

	var req struct {
		Name        string   `json:"name"`
		APIProducts []string `json:"apiProducts"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON: "+err.Error())
		return
	}

	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "App name is required")
		return
	}

	if err := s.client.CreateDeveloperApp(ctx, email, req.Name, req.APIProducts); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create app: "+err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{
		"message": "App created successfully",
		"name":    req.Name,
	})
}

// DeveloperAppDeleteHandler removes an app from a developer.
func (s *Server) DeveloperAppDeleteHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	email := r.URL.Query().Get("email")
	appName := r.URL.Query().Get("appName")
	if email == "" || appName == "" {
		writeError(w, http.StatusBadRequest, "Both email and appName are required")
		return
	}

	if err := s.client.DeleteDeveloperApp(ctx, email, appName); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to delete app: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "App deleted successfully"})
}

// AppKeyCreateHandler generates a new credential key for an app.
func (s *Server) AppKeyCreateHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	email := r.URL.Query().Get("email")
	appName := r.URL.Query().Get("appName")
	if email == "" || appName == "" {
		writeError(w, http.StatusBadRequest, "Both email and appName are required")
		return
	}

	var req struct {
		APIProducts []string `json:"apiProducts"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	if err := s.client.CreateAppCredentialKey(ctx, email, appName, req.APIProducts); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to generate key: "+err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{"message": "Key created successfully"})
}

// AppKeyDeleteHandler revokes and deletes a key.
func (s *Server) AppKeyDeleteHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	email := r.URL.Query().Get("email")
	appName := r.URL.Query().Get("appName")
	key := r.URL.Query().Get("key")
	if email == "" || appName == "" || key == "" {
		writeError(w, http.StatusBadRequest, "email, appName, and key are required")
		return
	}

	if err := s.client.DeleteAppCredentialKey(ctx, email, appName, key); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to delete key: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Key deleted successfully"})
}

// AppKeySubscriptionsHandler updates the subscribed products on a specific key.
func (s *Server) AppKeySubscriptionsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	email := r.URL.Query().Get("email")
	appName := r.URL.Query().Get("appName")
	key := r.URL.Query().Get("key")
	if email == "" || appName == "" || key == "" {
		writeError(w, http.StatusBadRequest, "email, appName, and key are required")
		return
	}

	var req struct {
		APIProducts []string `json:"apiProducts"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON: "+err.Error())
		return
	}

	// Fetch current app to see existing products on this key
	app, err := s.client.GetDeveloperApp(ctx, email, appName)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to get app details: "+err.Error())
		return
	}

	var currentProducts []string
	for _, cred := range app.Credentials {
		if cred.ConsumerKey == key {
			for _, p := range cred.APIProducts {
				currentProducts = append(currentProducts, p.Apiproduct)
			}
			break
		}
	}

	// Determine products to add and remove
	targetSet := make(map[string]bool)
	for _, p := range req.APIProducts {
		targetSet[p] = true
	}

	currentSet := make(map[string]bool)
	for _, p := range currentProducts {
		currentSet[p] = true
	}

	// Remove products not in target
	for _, p := range currentProducts {
		if !targetSet[p] {
			_ = s.client.RemoveProductFromKey(ctx, email, appName, key, p)
		}
	}

	// Add products in target not in current
	var toAdd []string
	for _, p := range req.APIProducts {
		if !currentSet[p] {
			toAdd = append(toAdd, p)
		}
	}

	if len(toAdd) > 0 {
		if err := s.client.AddProductsToKey(ctx, email, appName, key, toAdd); err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to add products to key: "+err.Error())
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":     "Subscriptions updated successfully",
		"apiProducts": req.APIProducts,
	})
}

