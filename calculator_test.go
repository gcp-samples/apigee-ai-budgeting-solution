package main

import (
	"testing"
)

func TestDefaultPriceList(t *testing.T) {
	prices := DefaultPriceList()

	requiredModels := []string{
		"default",
		"gemini-3.5-flash-lite",
		"gemini-3.8-flash",
		"gemini-2.0-flash",
		"gemini-2.5-flash",
		"gemini-2.5-pro",
		"gemini-1.5-flash",
		"gemini-1.5-pro",
		"claude-sonnet-5",
		"claude-opus-5-5",
		"claude-opus-5",
		"claude-3-5-sonnet",
		"claude-3-7-sonnet",
		"claude-3-5-haiku",
		"gpt-4o",
		"gpt-4o-mini",
		"o1",
		"o3-mini",
		"glm-5.2-maas",
	}

	for _, m := range requiredModels {
		p, ok := prices[m]
		if !ok {
			t.Errorf("expected model %q to be in DefaultPriceList", m)
			continue
		}
		if p.RequestPerMillionTokens <= 0 {
			t.Errorf("model %q: expected RequestPerMillionTokens > 0, got %f", m, p.RequestPerMillionTokens)
		}
		if p.ResponsePerMillionTokens <= 0 {
			t.Errorf("model %q: expected ResponsePerMillionTokens > 0, got %f", m, p.ResponsePerMillionTokens)
		}
	}
}

func TestGetEffectivePrice(t *testing.T) {
	prices := DefaultPriceList()

	// Existing model
	p := prices.GetEffectivePrice("gemini-3.5-flash-lite")
	if p.RequestPerMillionTokens != 0.05 {
		t.Errorf("expected request price 0.05, got %f", p.RequestPerMillionTokens)
	}

	// Unknown model fallback to default
	unknown := prices.GetEffectivePrice("unknown-future-model")
	def := prices["default"]
	if unknown.RequestPerMillionTokens != def.RequestPerMillionTokens {
		t.Errorf("expected fallback to default %f, got %f", def.RequestPerMillionTokens, unknown.RequestPerMillionTokens)
	}
}
