package main

import (
	"encoding/json"
	"math"
)

// ModelPrice defines pricing per million tokens for request, response, and cached tokens.
type ModelPrice struct {
	RequestPerMillionTokens       float64 `json:"requestPerMillionTokens"`
	ResponsePerMillionTokens      float64 `json:"responsePerMillionTokens"`
	CachedRequestPerMillionTokens float64 `json:"cachedRequestPerMillionTokens,omitempty"`
}

// PriceList is a mapping of model name (or "default") to its pricing configuration.
type PriceList map[string]ModelPrice

// DefaultPriceList provides default fallback prices if the KVM has not yet been initialized.
func DefaultPriceList() PriceList {
	return PriceList{
		"default": ModelPrice{
			RequestPerMillionTokens:       1.0,
			ResponsePerMillionTokens:      3.0,
			CachedRequestPerMillionTokens: 0.25,
		},
		"gemini-1.5-flash": ModelPrice{
			RequestPerMillionTokens:       0.075,
			ResponsePerMillionTokens:      0.30,
			CachedRequestPerMillionTokens: 0.01875,
		},
		"gemini-1.5-pro": ModelPrice{
			RequestPerMillionTokens:       1.25,
			ResponsePerMillionTokens:      5.0,
			CachedRequestPerMillionTokens: 0.3125,
		},
		"gemini-2.0-flash": ModelPrice{
			RequestPerMillionTokens:       0.10,
			ResponsePerMillionTokens:      0.40,
			CachedRequestPerMillionTokens: 0.025,
		},
		"gemini-2.5-flash": ModelPrice{
			RequestPerMillionTokens:       0.10,
			ResponsePerMillionTokens:      0.40,
			CachedRequestPerMillionTokens: 0.025,
		},
		"gemini-2.5-pro": ModelPrice{
			RequestPerMillionTokens:       1.25,
			ResponsePerMillionTokens:      5.0,
			CachedRequestPerMillionTokens: 0.3125,
		},
		"gemini-3.5-flash-lite": ModelPrice{
			RequestPerMillionTokens:       0.05,
			ResponsePerMillionTokens:      0.20,
			CachedRequestPerMillionTokens: 0.0125,
		},
		"gemini-3.8-flash": ModelPrice{
			RequestPerMillionTokens:       0.15,
			ResponsePerMillionTokens:      0.60,
			CachedRequestPerMillionTokens: 0.0375,
		},
		"claude-3-5-haiku": ModelPrice{
			RequestPerMillionTokens:       0.80,
			ResponsePerMillionTokens:      4.0,
			CachedRequestPerMillionTokens: 0.08,
		},
		"claude-3-5-sonnet": ModelPrice{
			RequestPerMillionTokens:       3.0,
			ResponsePerMillionTokens:      15.0,
			CachedRequestPerMillionTokens: 0.30,
		},
		"claude-3-7-sonnet": ModelPrice{
			RequestPerMillionTokens:       3.0,
			ResponsePerMillionTokens:      15.0,
			CachedRequestPerMillionTokens: 0.30,
		},
		"claude-sonnet-5": ModelPrice{
			RequestPerMillionTokens:       3.0,
			ResponsePerMillionTokens:      15.0,
			CachedRequestPerMillionTokens: 0.30,
		},
		"claude-opus-5": ModelPrice{
			RequestPerMillionTokens:       15.0,
			ResponsePerMillionTokens:      75.0,
			CachedRequestPerMillionTokens: 1.50,
		},
		"claude-opus-5-5": ModelPrice{
			RequestPerMillionTokens:       15.0,
			ResponsePerMillionTokens:      75.0,
			CachedRequestPerMillionTokens: 1.50,
		},
		"gpt-4o": ModelPrice{
			RequestPerMillionTokens:       2.50,
			ResponsePerMillionTokens:      10.0,
			CachedRequestPerMillionTokens: 1.25,
		},
		"gpt-4o-mini": ModelPrice{
			RequestPerMillionTokens:       0.15,
			ResponsePerMillionTokens:      0.60,
			CachedRequestPerMillionTokens: 0.075,
		},
		"o1": ModelPrice{
			RequestPerMillionTokens:       15.0,
			ResponsePerMillionTokens:      60.0,
			CachedRequestPerMillionTokens: 7.50,
		},
		"o3-mini": ModelPrice{
			RequestPerMillionTokens:       1.10,
			ResponsePerMillionTokens:      4.40,
			CachedRequestPerMillionTokens: 0.55,
		},
		"glm-5.2-maas": ModelPrice{
			RequestPerMillionTokens:       1.0,
			ResponsePerMillionTokens:      3.0,
			CachedRequestPerMillionTokens: 0.25,
		},
	}
}

// ParsePriceList parses a JSON string into a PriceList map.
func ParsePriceList(jsonStr string) (PriceList, error) {
	if jsonStr == "" {
		return DefaultPriceList(), nil
	}
	var prices PriceList
	if err := json.Unmarshal([]byte(jsonStr), &prices); err != nil {
		return nil, err
	}
	return prices, nil
}

// GetEffectivePrice resolves pricing for a specific model, falling back to "default".
func (pl PriceList) GetEffectivePrice(model string) ModelPrice {
	if p, ok := pl[model]; ok && (p.RequestPerMillionTokens > 0 || p.ResponsePerMillionTokens > 0) {
		return p
	}
	if def, ok := pl["default"]; ok {
		return def
	}
	return ModelPrice{
		RequestPerMillionTokens:  1.0,
		ResponsePerMillionTokens: 3.0,
	}
}

// BlendedPricePerMillion calculates the weighted cost per million tokens.
// promptRatio: typically 0.75 (75% prompt / 25% response).
func (mp ModelPrice) BlendedPricePerMillion(promptRatio float64) float64 {
	if promptRatio <= 0 || promptRatio >= 1 {
		promptRatio = 0.75
	}
	completionRatio := 1.0 - promptRatio
	return (mp.RequestPerMillionTokens * promptRatio) + (mp.ResponsePerMillionTokens * completionRatio)
}

// ConvertTokensToMoney converts a token count limit into an estimated budget amount in USD.
func ConvertTokensToMoney(model string, tokenLimit int64, prices PriceList, promptRatio float64) (float64, float64) {
	p := prices.GetEffectivePrice(model)
	blended := p.BlendedPricePerMillion(promptRatio)
	if blended <= 0 {
		blended = 1.0
	}
	amount := (float64(tokenLimit) / 1000000.0) * blended
	return math.Round(amount*100) / 100, blended
}

// ConvertMoneyToTokens converts a budget amount in USD into a token count limit.
func ConvertMoneyToTokens(model string, budgetUSD float64, prices PriceList, promptRatio float64) (int64, float64) {
	p := prices.GetEffectivePrice(model)
	blended := p.BlendedPricePerMillion(promptRatio)
	if blended <= 0 {
		blended = 1.0
	}
	tokens := (budgetUSD / blended) * 1000000.0
	return int64(math.Round(tokens)), blended
}
