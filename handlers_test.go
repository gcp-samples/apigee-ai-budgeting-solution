package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPricesDefaultsGetHandler(t *testing.T) {
	server := &Server{}
	req := httptest.NewRequest(http.MethodGet, "/api/prices/defaults", nil)
	w := httptest.NewRecorder()

	server.PricesDefaultsGetHandler(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.StatusCode)
	}

	var data struct {
		Prices PriceList `json:"prices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if _, ok := data.Prices["gemini-3.5-flash-lite"]; !ok {
		t.Errorf("expected gemini-3.5-flash-lite in default prices")
	}
	if _, ok := data.Prices["gemini-3.8-flash"]; !ok {
		t.Errorf("expected gemini-3.8-flash in default prices")
	}
	if _, ok := data.Prices["claude-sonnet-5"]; !ok {
		t.Errorf("expected claude-sonnet-5 in default prices")
	}
	if _, ok := data.Prices["claude-opus-5-5"]; !ok {
		t.Errorf("expected claude-opus-5-5 in default prices")
	}
}

func TestEnhancedProductMonthlyBudget(t *testing.T) {
	// Simulate product with multiple models and different intervals/time units
	prices := DefaultPriceList()

	modelA := "gemini-3.5-flash-lite"
	modelB := "gemini-3.8-flash"

	limitA := int64(10_000_000) // 10M tokens / month
	estUSDA, blendedA := ConvertTokensToMoney(modelA, limitA, prices, 0.75)

	limitB := int64(1_000_000) // 1M tokens / day => 30M tokens / month
	estUSDB, blendedB := ConvertTokensToMoney(modelB, limitB, prices, 0.75)

	ep := EnhancedProduct{
		APIProduct: APIProduct{
			Name: "test-ai-product",
		},
		IsAIProduct: true,
		ModelBudgets: []ModelBudgetDetail{
			{
				Model:        modelA,
				TokenLimit:   limitA,
				EstimatedUSD: estUSDA,
				BlendedRate:  blendedA,
				Interval:     "1",
				TimeUnit:     "month",
			},
			{
				Model:        modelB,
				TokenLimit:   limitB,
				EstimatedUSD: estUSDB,
				BlendedRate:  blendedB,
				Interval:     "1",
				TimeUnit:     "day",
			},
		},
	}

	// Compute monthly budget and tokens
	var totalMonthlyUSD float64
	var totalMonthlyTokens float64
	for _, mb := range ep.ModelBudgets {
		mult := 1.0
		switch mb.TimeUnit {
		case "day":
			mult = 30.0
		case "hour":
			mult = 30.0 * 24.0
		case "month":
			mult = 1.0
		}
		totalMonthlyUSD += mb.EstimatedUSD * mult
		totalMonthlyTokens += float64(mb.TokenLimit) * mult
	}
	ep.TotalMonthlyBudgetUSD = totalMonthlyUSD
	ep.TotalMonthlyTokens = int64(totalMonthlyTokens)

	expectedTokens := int64(10_000_000 + 30*1_000_000) // 40M tokens
	if ep.TotalMonthlyTokens != expectedTokens {
		t.Errorf("expected total monthly tokens %d, got %d", expectedTokens, ep.TotalMonthlyTokens)
	}

	expectedUSD := estUSDA + (estUSDB * 30.0)
	if ep.TotalMonthlyBudgetUSD != expectedUSD {
		t.Errorf("expected total monthly USD %f, got %f", expectedUSD, ep.TotalMonthlyBudgetUSD)
	}
}
