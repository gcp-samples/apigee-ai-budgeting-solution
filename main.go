package main

import (
	"bufio"
	"context"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// loadDotEnv reads .env if present and sets any unset environment variables
func loadDotEnv() {
	f, err := os.Open(".env")
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		line = strings.TrimPrefix(line, "export ")
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			k := strings.TrimSpace(parts[0])
			v := strings.TrimSpace(parts[1])
			v = strings.Trim(v, `"'`)
			if os.Getenv(k) == "" {
				os.Setenv(k, v)
			}
		}
	}
}

func main() {
	loadDotEnv()
	ctx := context.Background()

	client, err := NewApigeeClient(ctx)
	if err != nil {
		log.Fatalf("Failed to initialize Apigee client: %v", err)
	}

	server := &Server{
		client: client,
	}

	mux := http.NewServeMux()

	// Health and Configuration
	mux.HandleFunc("/healthz", server.HealthHandler)
	mux.HandleFunc("/api/config", server.ConfigHandler)
	mux.HandleFunc("/api/environments", server.EnvironmentsHandler)

	// Price Lists (KVM AI-Config.PriceList)
	mux.HandleFunc("/api/prices", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			server.PricesGetHandler(w, r)
		case http.MethodPost:
			server.PricesSaveHandler(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/api/prices/defaults", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		server.PricesDefaultsGetHandler(w, r)
	})

	mux.HandleFunc("/api/prices/load-defaults", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		server.PricesLoadDefaultsHandler(w, r)
	})

	// Budget Conversions
	mux.HandleFunc("/api/convert-budget", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		server.ConvertBudgetHandler(w, r)
	})

	// Products & Budgets
	mux.HandleFunc("/api/products", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			server.ProductsHandler(w, r)
		case http.MethodPost:
			server.ProductCreateHandler(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// Specific Product routes (/api/products/{name} and /api/products/{name}/budget)
	mux.HandleFunc("/api/products/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/budget") {
			if r.Method != http.MethodPost {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				return
			}
			server.ProductBudgetHandler(w, r)
			return
		}

		switch r.Method {
		case http.MethodGet:
			server.ProductGetHandler(w, r)
		case http.MethodPut:
			server.ProductUpdateHandler(w, r)
		case http.MethodDelete:
			server.ProductDeleteHandler(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// Analytics APIs
	mux.HandleFunc("/api/analytics/overview", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		server.AnalyticsOverviewHandler(w, r)
	})

	mux.HandleFunc("/api/analytics/breakdown", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		server.AnalyticsBreakdownHandler(w, r)
	})

	mux.HandleFunc("/api/analytics/timeseries", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		server.AnalyticsTimeSeriesHandler(w, r)
	})

	// Developer & App APIs
	mux.HandleFunc("/api/developers", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			server.DevelopersListHandler(w, r)
		case http.MethodPost:
			server.DeveloperCreateHandler(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/api/developers/single", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			server.DeveloperGetHandler(w, r)
		case http.MethodPut:
			server.DeveloperUpdateHandler(w, r)
		case http.MethodDelete:
			server.DeveloperDeleteHandler(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/api/developers/apps", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			server.DeveloperAppsListHandler(w, r)
		case http.MethodPost:
			server.DeveloperAppCreateHandler(w, r)
		case http.MethodDelete:
			server.DeveloperAppDeleteHandler(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/api/developers/apps/keys", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			server.AppKeyCreateHandler(w, r)
		case http.MethodDelete:
			server.AppKeyDeleteHandler(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/api/developers/apps/keys/subscriptions", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPut, http.MethodPost:
			server.AppKeySubscriptionsHandler(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// Static files from ./public
	publicDir := "./public"
	fs := http.FileServer(http.Dir(publicDir))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}

		// Check if file exists in publicDir
		fPath := filepath.Join(publicDir, filepath.Clean(r.URL.Path))
		info, err := os.Stat(fPath)
		if err == nil && !info.IsDir() {
			fs.ServeHTTP(w, r)
			return
		}

		// Fallback to index.html for SPA routing
		http.ServeFile(w, r, filepath.Join(publicDir, "index.html"))
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	addr := port
	if !strings.Contains(port, ":") {
		addr = ":" + port
	}

	displayHost := addr
	if strings.HasPrefix(addr, ":") {
		displayHost = "http://localhost" + addr
	} else {
		displayHost = "http://" + addr
	}
	log.Printf("Starting Apigee AI Budgeting Console on %s (listening on %s) (Apigee Org: %s)", displayHost, addr, client.GetProjectID())

	s := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 45 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	if err := s.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server failed: %v", err)
	}
}
