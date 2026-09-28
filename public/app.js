// Apigee AI Budgeting & Analytics Console Frontend
(function () {
  'use strict';

  // State
  const state = {
    project: '',
    environments: ['dev'],
    selectedEnv: 'dev',
    timeRange: '30d',
    currentDimension: 'dc_ai_model',
    prices: {},
    pricesModified: false,
    products: [],
    analyticsOverview: null,
    breakdownRows: [],
    timelineData: [],
    currentEditingProduct: null,
    developers: [],
    selectedDeveloper: null,
    selectedDeveloperApps: [],
    selectedManagingApp: null,
    selectedManagingKey: null
  };

  // DOM Elements
  const el = {
    orgDisplay: document.getElementById('org-display'),
    envSelector: document.getElementById('env-selector'),
    timeRangeSelector: document.getElementById('time-range-selector'),
    themeToggle: document.getElementById('theme-toggle'),
    themeIconSun: document.getElementById('theme-icon-sun'),
    themeIconMoon: document.getElementById('theme-icon-moon'),
    navTabs: document.querySelectorAll('.nav-tab'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    toastContainer: document.getElementById('toast-container'),

    // Analytics
    btnRefreshAnalytics: document.getElementById('btn-refresh-analytics'),
    btnRefreshText: document.getElementById('btn-refresh-text'),
    kpiCards: document.querySelectorAll('.kpi-card'),
    kpiTotalSpend: document.getElementById('kpi-total-spend'),
    kpiSpendBreakdown: document.getElementById('kpi-spend-breakdown'),
    kpiTotalTokens: document.getElementById('kpi-total-tokens'),
    kpiTokensBreakdown: document.getElementById('kpi-tokens-breakdown'),
    kpiAvgTtft: document.getElementById('kpi-avg-ttft'),
    kpiTotalCalls: document.getElementById('kpi-total-calls'),
    kpiStreamingBreakdown: document.getElementById('kpi-streaming-breakdown'),
    chartTimeline: document.getElementById('chart-timeline'),
    chartModelDist: document.getElementById('chart-model-dist'),
    overlayTimeline: document.getElementById('overlay-timeline'),
    overlayModelDist: document.getElementById('overlay-model-dist'),
    dimButtons: document.querySelectorAll('.dim-btn'),
    thDimName: document.getElementById('th-dim-name'),
    analyticsSearch: document.getElementById('analytics-search'),
    analyticsTableBody: document.getElementById('analytics-table-body'),

    // Prices
    btnLoadDefaults: document.getElementById('btn-load-defaults'),
    btnOpenAddModel: document.getElementById('btn-open-add-model'),
    btnOpenCalculator: document.getElementById('btn-open-calculator'),
    btnViewRawJson: document.getElementById('btn-view-raw-json'),
    btnOpenDeployKvm: document.getElementById('btn-open-deploy-kvm'),
    activePriceEnv: document.getElementById('active-price-env'),
    kvmStatusDot: document.getElementById('kvm-status-dot'),
    kvmStatusBadge: document.getElementById('kvm-status-badge'),
    modelCount: document.getElementById('model-count'),
    priceSearch: document.getElementById('price-search'),
    priceTableBody: document.getElementById('price-table-body'),

    // Products
    btnOpenCreateProduct: document.getElementById('btn-open-create-product'),
    btnRefreshProducts: document.getElementById('btn-refresh-products'),
    productsListContainer: document.getElementById('products-list-container'),

    // Users & Groups
    btnRefreshDevelopers: document.getElementById('btn-refresh-developers'),
    btnRefreshDevText: document.getElementById('btn-refresh-dev-text'),
    btnOpenCreateDeveloper: document.getElementById('btn-open-create-developer'),
    inputSearchDevs: document.getElementById('input-search-devs'),
    badgeDevCount: document.getElementById('badge-dev-count'),
    tbodyDevelopers: document.getElementById('tbody-developers'),
    valTotalDevs: document.getElementById('val-total-devs'),
    valTotalApps: document.getElementById('val-total-apps'),
    valTotalDevSpend: document.getElementById('val-total-dev-spend'),
    valTotalDevTokens: document.getElementById('val-total-dev-tokens'),

    // Modals
    modalModelPrice: document.getElementById('modal-model-price'),
    formModelPrice: document.getElementById('form-model-price'),
    priceModelName: document.getElementById('price-model-name'),
    priceReq: document.getElementById('price-req'),
    priceResp: document.getElementById('price-resp'),
    priceCached: document.getElementById('price-cached'),
    pricePreviewBlended: document.getElementById('price-preview-blended'),

    modalDeployKvm: document.getElementById('modal-deploy-kvm'),
    formDeployKvm: document.getElementById('form-deploy-kvm'),
    deployEnvCheckboxes: document.getElementById('deploy-env-checkboxes'),

    modalRawJson: document.getElementById('modal-raw-json'),
    formRawJson: document.getElementById('form-raw-json'),
    rawJsonEditor: document.getElementById('raw-json-editor'),

    modalCalculator: document.getElementById('modal-calculator'),
    calcPromptTokens: document.getElementById('calc-prompt-tokens'),
    calcRespTokens: document.getElementById('calc-resp-tokens'),
    calcResultsBody: document.getElementById('calc-results-body'),

    modalEditBudget: document.getElementById('modal-edit-budget'),
    formEditBudget: document.getElementById('form-edit-budget'),
    budgetProductBadge: document.getElementById('budget-product-badge'),
    modalTotalMonthlyBudget: document.getElementById('modal-total-monthly-budget'),
    productModelsContainer: document.getElementById('product-models-container'),
    btnAddModelToProduct: document.getElementById('btn-add-model-to-product'),
    budgetEnvCheckboxes: document.getElementById('budget-env-checkboxes'),

    modalCreateProduct: document.getElementById('modal-create-product'),
    formCreateProduct: document.getElementById('form-create-product'),
    newProdName: document.getElementById('new-prod-name'),
    newProdDisplay: document.getElementById('new-prod-display'),
    newProdDesc: document.getElementById('new-prod-desc'),
    newProdProxy: document.getElementById('new-prod-proxy'),
    newProdEnvCheckboxes: document.getElementById('new-prod-env-checkboxes'),
    newProdModelsList: document.getElementById('new-prod-models-list'),
    btnAddInitialModel: document.getElementById('btn-add-initial-model'),

    modalCreateDeveloper: document.getElementById('modal-create-developer'),
    formCreateDeveloper: document.getElementById('form-create-developer'),
    newDevEmail: document.getElementById('new-dev-email'),
    newDevFirstname: document.getElementById('new-dev-firstname'),
    newDevLastname: document.getElementById('new-dev-lastname'),
    newDevUsername: document.getElementById('new-dev-username'),

    modalDeveloperDetail: document.getElementById('modal-developer-detail'),
    modalDevSubtitle: document.getElementById('modal-dev-subtitle'),
    devDetailBanner: document.getElementById('dev-detail-banner'),
    devAppsLoading: document.getElementById('dev-apps-loading'),
    devAppsEmpty: document.getElementById('dev-apps-empty'),
    devAppsContainer: document.getElementById('dev-apps-container'),
    btnOpenCreateApp: document.getElementById('btn-open-create-app'),
    btnEmptyCreateApp: document.getElementById('btn-empty-create-app'),

    modalCreateApp: document.getElementById('modal-create-app'),
    formCreateApp: document.getElementById('form-create-app'),
    createAppDevEmail: document.getElementById('create-app-dev-email'),
    createAppName: document.getElementById('create-app-name'),
    createAppProductsList: document.getElementById('create-app-products-list'),

    modalManageSubscriptions: document.getElementById('modal-manage-subscriptions'),
    formManageSubscriptions: document.getElementById('form-manage-subscriptions'),
    manageSubAppName: document.getElementById('manage-sub-app-name'),
    manageSubKeySnippet: document.getElementById('manage-sub-key-snippet'),
    manageSubProductsList: document.getElementById('manage-sub-products-list')
  };

  // LocalStorage Cache Manager (Stale-While-Revalidate)
  const Cache = {
    prefix: 'apigee_ai_',
    get(key) {
      try {
        const item = localStorage.getItem(this.prefix + key);
        if (!item) return null;
        return JSON.parse(item);
      } catch (err) {
        console.warn('LocalStorage read error for key ' + key, err);
        return null;
      }
    },
    set(key, val) {
      try {
        localStorage.setItem(this.prefix + key, JSON.stringify(val));
      } catch (err) {
        console.warn('LocalStorage write error for key ' + key, err);
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(this.prefix + key);
      } catch (err) {}
    }
  };

  // Toast Helper
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    el.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Formatters
  function formatMoney(amount, decimals = 2) {
    if (amount === undefined || amount === null || isNaN(amount)) return '$0.00';
    if (amount < 0.01 && amount > 0) return '$' + amount.toFixed(4);
    return '$' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function formatNumber(num) {
    if (num === undefined || num === null || isNaN(num)) return '0';
    return Number(num).toLocaleString('en-US');
  }

  // Compute Blended Rate: 75% prompt + 25% completion
  function calcBlended(reqPrice, respPrice, promptRatio = 0.75) {
    reqPrice = parseFloat(reqPrice) || 0;
    respPrice = parseFloat(respPrice) || 0;
    return (reqPrice * promptRatio) + (respPrice * (1.0 - promptRatio));
  }

  // Theme Management
  function initTheme() {
    const savedTheme = localStorage.getItem('theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(savedTheme);

    el.themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      setTheme(next);
    });
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      el.themeIconSun.style.display = 'block';
      el.themeIconMoon.style.display = 'none';
    } else {
      el.themeIconSun.style.display = 'none';
      el.themeIconMoon.style.display = 'block';
    }
    // Redraw charts if visible
    if (document.getElementById('tab-analytics').classList.contains('active')) {
      renderCharts();
    }
  }

  // Modal Setup & Light-Dismiss Fallback
  function setupModals() {
    document.querySelectorAll('dialog').forEach(dialog => {
      // Light-dismiss fallback for older browsers
      if (!('closedBy' in HTMLDialogElement.prototype)) {
        dialog.addEventListener('click', (event) => {
          if (event.target !== dialog) return;
          const rect = dialog.getBoundingClientRect();
          const inContent = (
            rect.top <= event.clientY &&
            event.clientY <= rect.top + rect.height &&
            rect.left <= event.clientX &&
            event.clientX <= rect.left + rect.width
          );
          if (!inContent) dialog.close();
        });
      }

      // Close buttons
      dialog.querySelectorAll('.close-dialog-btn').forEach(btn => {
        btn.addEventListener('click', () => dialog.close());
      });
    });
  }

  // Navigation Tabs
  function setupNavigation() {
    el.navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        el.navTabs.forEach(t => t.classList.remove('active'));
        el.tabPanes.forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        const targetId = tab.getAttribute('data-tab');
        const pane = document.getElementById(targetId);
        if (pane) pane.classList.add('active');

        if (targetId === 'tab-analytics') {
          loadAnalytics();
        } else if (targetId === 'tab-prices') {
          loadPrices();
        } else if (targetId === 'tab-products') {
          loadProducts();
        } else if (targetId === 'tab-developers') {
          loadDevelopers();
        }
      });
    });
  }

  // Date Range Helper for Apigee Analytics
  function getTimeRangeParam() {
    const now = new Date();
    let start = new Date();
    if (state.timeRange === '24h') {
      start.setDate(now.getDate() - 1);
    } else if (state.timeRange === '7d') {
      start.setDate(now.getDate() - 7);
    } else if (state.timeRange === 'all') {
      start.setDate(now.getDate() - 60);
    } else {
      // 30 days default
      start.setDate(now.getDate() - 30);
    }

    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (d) => `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    return `${fmt(start)}~${fmt(now)}`;
  }

  // Load Organization Config
  async function loadConfig() {
    try {
      const resp = await fetch('/api/config');
      if (!resp.ok) throw new Error('Failed to load configuration');
      const data = await resp.json();
      state.project = data.project || 'aigateway-lab8';
      el.orgDisplay.textContent = state.project;

      if (data.environments && data.environments.length > 0) {
        state.environments = data.environments;
        el.envSelector.innerHTML = '';
        data.environments.forEach(env => {
          const opt = document.createElement('option');
          opt.value = env;
          opt.textContent = env;
          el.envSelector.appendChild(opt);
        });
        state.selectedEnv = data.environments[0];
      }
    } catch (err) {
      console.warn('Config load failed:', err);
      el.orgDisplay.textContent = 'aigateway-lab8';
    }
  }

  // ==================== TAB 1: ANALYTICS ====================

  function renderTableSkeleton() {
    if (!el.analyticsTableBody) return;
    el.analyticsTableBody.innerHTML = `
      <tr><td colspan="8" style="padding: 1.25rem;"><div class="skeleton-bar" style="width: 100%; height: 24px;"></div></td></tr>
      <tr><td colspan="8" style="padding: 1.25rem;"><div class="skeleton-bar" style="width: 100%; height: 24px;"></div></td></tr>
      <tr><td colspan="8" style="padding: 1.25rem;"><div class="skeleton-bar" style="width: 100%; height: 24px;"></div></td></tr>
    `;
  }

  function setAnalyticsLoading(loading, isBackground = false, isUserInitiated = false) {
    state.isLoadingAnalytics = loading;

    // 1. Toggle KPI shimmer (only if not background revalidating)
    if (el.kpiCards) {
      el.kpiCards.forEach(card => {
        if (loading && !isBackground) card.classList.add('is-loading');
        else card.classList.remove('is-loading');
      });
    }

    // 2. Toggle Chart Overlays (only if not background revalidating)
    if (el.overlayTimeline) {
      if (loading && !isBackground) el.overlayTimeline.classList.add('active');
      else el.overlayTimeline.classList.remove('active');
    }
    if (el.overlayModelDist) {
      if (loading && !isBackground) el.overlayModelDist.classList.add('active');
      else el.overlayModelDist.classList.remove('active');
    }

    // 3. Toggle Refresh Button State & Spinner (only if user explicitly clicked Refresh)
    if (el.btnRefreshAnalytics) {
      if (loading && isUserInitiated) {
        el.btnRefreshAnalytics.disabled = true;
        el.btnRefreshAnalytics.classList.add('is-spinning');
      } else {
        el.btnRefreshAnalytics.disabled = false;
        el.btnRefreshAnalytics.classList.remove('is-spinning');
      }
    }
    if (el.btnRefreshText) {
      el.btnRefreshText.textContent = (loading && isUserInitiated) ? 'Updating...' : 'Refresh';
    }

    // 4. Show Table Skeleton while loading (only if not background revalidating)
    if (loading && !isBackground) {
      renderTableSkeleton();
    }
  }

  async function loadAnalytics(forceRefresh = false) {
    const env = state.selectedEnv;
    const timeRange = getTimeRangeParam();
    const cacheKey = `analytics_${env}_${state.timeRange}`;

    let hasCachedData = false;
    if (!forceRefresh) {
      const cached = Cache.get(cacheKey);
      if (cached && cached.overview) {
        hasCachedData = true;
        state.analyticsOverview = cached.overview;
        state.timelineData = cached.timelineData || [];
        if (cached.dimension === state.currentDimension) {
          state.breakdownRows = cached.breakdownRows || [];
        }
        renderKPIs(state.analyticsOverview);
        renderCharts();
        if (cached.dimension === state.currentDimension && state.breakdownRows.length > 0) {
          renderBreakdownTable();
        }
      }
    }

    setAnalyticsLoading(true, hasCachedData, forceRefresh);

    try {
      // Fetch overview, timeseries, and breakdown concurrently in parallel
      const [overviewResp, tsResp, breakdownResp] = await Promise.allSettled([
        fetch(`/api/analytics/overview?env=${encodeURIComponent(env)}&timeRange=${encodeURIComponent(timeRange)}`),
        fetch(`/api/analytics/timeseries?env=${encodeURIComponent(env)}&timeRange=${encodeURIComponent(timeRange)}&timeUnit=day`),
        fetch(`/api/analytics/breakdown?env=${encodeURIComponent(env)}&dimension=${encodeURIComponent(state.currentDimension)}&timeRange=${encodeURIComponent(timeRange)}`)
      ]);

      let overviewData = state.analyticsOverview;
      let tsData = state.timelineData;
      let breakdownData = state.breakdownRows;

      if (overviewResp.status === 'fulfilled' && overviewResp.value.ok) {
        overviewData = await overviewResp.value.json();
      }

      if (tsResp.status === 'fulfilled' && tsResp.value.ok) {
        tsData = await tsResp.value.json();
      }

      if (breakdownResp.status === 'fulfilled' && breakdownResp.value.ok) {
        const data = await breakdownResp.value.json();
        breakdownData = data.rows || [];
      }

      // Check differences against state
      const overviewChanged = JSON.stringify(overviewData) !== JSON.stringify(state.analyticsOverview);
      const tsChanged = JSON.stringify(tsData) !== JSON.stringify(state.timelineData);
      const breakdownChanged = JSON.stringify(breakdownData) !== JSON.stringify(state.breakdownRows);

      state.analyticsOverview = overviewData;
      state.timelineData = tsData;
      state.breakdownRows = breakdownData;

      if (!hasCachedData || overviewChanged) {
        renderKPIs(state.analyticsOverview);
      }
      if (!hasCachedData || overviewChanged || tsChanged) {
        renderCharts();
      }
      if (!hasCachedData || breakdownChanged) {
        renderBreakdownTable();
      }

      // Store fresh cache
      Cache.set(cacheKey, {
        overview: state.analyticsOverview,
        timelineData: state.timelineData,
        breakdownRows: state.breakdownRows,
        dimension: state.currentDimension
      });
      Cache.set(`analytics_dim_${env}_${state.timeRange}_${state.currentDimension}`, state.breakdownRows);
    } catch (err) {
      if (!hasCachedData) {
        showToast('Error loading analytics: ' + err.message, 'error');
      } else {
        console.warn('Background analytics refresh failed:', err);
      }
    } finally {
      setAnalyticsLoading(false);
    }
  }

  function renderKPIs(data) {
    if (!data) return;
    el.kpiTotalSpend.textContent = formatMoney(data.totalSpend, 4);
    el.kpiSpendBreakdown.textContent = `Prompt: ${formatMoney(data.requestSpend, 4)} | Output: ${formatMoney(data.responseSpend, 4)}`;

    el.kpiTotalTokens.textContent = formatNumber(data.totalTokens);
    el.kpiTokensBreakdown.textContent = `Prompt: ${formatNumber(data.promptTokens)} | Output: ${formatNumber(data.responseTokens)}`;

    el.kpiAvgTtft.textContent = `${formatNumber(data.avgLatencyMs)} ms`;
    el.kpiTotalCalls.textContent = formatNumber(data.totalCalls);

    let streamingCalls = 0;
    let nonStreamingCalls = 0;
    if (data.responseTypes) {
      data.responseTypes.forEach(rt => {
        if (rt.type === 'streaming') streamingCalls = rt.calls;
        if (rt.type === 'non-streaming') nonStreamingCalls = rt.calls;
      });
    }
    el.kpiStreamingBreakdown.textContent = `Streaming: ${formatNumber(streamingCalls)} | Standard: ${formatNumber(nonStreamingCalls)}`;
  }

  async function loadDimensionBreakdown(dimension) {
    state.currentDimension = dimension;
    const env = state.selectedEnv;
    const timeRange = getTimeRangeParam();

    const dimLabels = {
      'dc_ai_model': 'Model Name',
      'dc_ai_user': 'User ID / Email',
      'dc_ai_cost_center': 'Cost Center',
      'dc_ai_provider': 'AI Provider',
      'dc_ai_response_type': 'Response Type',
      'apiproxy': 'API Proxy'
    };

    el.thDimName.textContent = dimLabels[dimension] || dimension;

    // Update active button
    el.dimButtons.forEach(btn => {
      if (btn.getAttribute('data-dim') === dimension) {
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
      } else {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
      }
    });

    const cacheKey = `analytics_dim_${env}_${state.timeRange}_${dimension}`;
    const cachedRows = Cache.get(cacheKey);
    let hasCached = false;
    if (cachedRows && Array.isArray(cachedRows) && cachedRows.length > 0) {
      hasCached = true;
      state.breakdownRows = cachedRows;
      renderBreakdownTable();
    } else {
      renderTableSkeleton();
    }

    try {
      const resp = await fetch(`/api/analytics/breakdown?env=${encodeURIComponent(env)}&dimension=${encodeURIComponent(dimension)}&timeRange=${encodeURIComponent(timeRange)}`);
      if (resp.ok) {
        const data = await resp.json();
        const freshRows = data.rows || [];
        const changed = JSON.stringify(freshRows) !== JSON.stringify(state.breakdownRows);
        state.breakdownRows = freshRows;
        Cache.set(cacheKey, state.breakdownRows);
        if (!hasCached || changed) {
          renderBreakdownTable();
        }
      }
    } catch (err) {
      if (!hasCached) {
        console.error('Breakdown error:', err);
      }
    }
  }

  function renderBreakdownTable() {
    const q = (el.analyticsSearch.value || '').toLowerCase().trim();
    const rows = state.breakdownRows.filter(r => !q || (r.name && r.name.toLowerCase().includes(q)));

    const totalSpendAll = state.analyticsOverview ? (state.analyticsOverview.totalSpend || 0.0001) : 1;

    if (rows.length === 0) {
      el.analyticsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No usage records found for this dimension</td></tr>`;
      return;
    }

    // Sort by spend descending
    rows.sort((a, b) => b.totalCost - a.totalCost);

    el.analyticsTableBody.innerHTML = rows.map(r => {
      const sharePct = ((r.totalCost / totalSpendAll) * 100).toFixed(1);
      const isUnset = r.name === '(not set)' || !r.name;
      const displayName = isUnset ? '<span style="color: var(--text-muted); font-style: italic;">(not set / uncategorized)</span>' : `<strong>${escapeHtml(r.name)}</strong>`;

      return `
        <tr>
          <td>${displayName}</td>
          <td>${formatNumber(r.totalTokens)}</td>
          <td><strong style="color: var(--brand-primary);">${formatMoney(r.totalCost, 4)}</strong></td>
          <td>${r.avgTTFT > 0 ? Math.round(r.avgTTFT) + ' ms' : '-'}</td>
          <td>${formatNumber(r.calls)}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <div style="flex: 1; height: 6px; background: var(--bg-card-alt); border-radius: 3px; overflow: hidden;">
                <div style="width: ${Math.min(100, sharePct)}%; height: 100%; background: var(--brand-primary); border-radius: 3px;"></div>
              </div>
              <span style="font-size: 0.75rem; min-width: 38px;">${sharePct}%</span>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Native Canvas Charts (Zero external CDN dependencies)
  function renderCharts() {
    renderTimelineChart();
    renderModelDistChart();
  }

  function renderTimelineChart() {
    const canvas = el.chartTimeline;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.parentElement.clientWidth;
    const height = canvas.parentElement.clientHeight;

    // Retina support
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const data = (state.timelineData || []).slice().sort((a, b) => a.timestamp - b.timestamp);
    if (data.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No time series data available for selected range', width / 2, height / 2);
      return;
    }

    const padding = { top: 20, right: 30, bottom: 40, left: 55 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const maxCost = Math.max(...data.map(d => d.cost), 0.001);
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? '#1e293b' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    // Draw horizontal grid lines & Y axis
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.fillStyle = textColor;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';

    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH * i) / 4;
      const val = maxCost * (1 - i / 4);

      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      ctx.fillText(formatMoney(val, 4), padding.left - 8, y + 3);
    }

    // Draw Bars (Calls/Tokens) & Line (Spend)
    const stepX = chartW / (data.length || 1);

    // 1. Draw bars for tokens
    const maxTokens = Math.max(...data.map(d => d.tokens), 1);
    ctx.fillStyle = isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(37, 99, 235, 0.15)';
    data.forEach((d, idx) => {
      const barH = (d.tokens / maxTokens) * chartH;
      const barW = Math.max(stepX * 0.5, 4);
      const x = padding.left + idx * stepX + (stepX - barW) / 2;
      const y = padding.top + chartH - barH;
      ctx.fillRect(x, y, barW, barH);
    });

    // 2. Draw Spend Trend Line
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    data.forEach((d, idx) => {
      const x = padding.left + idx * stepX + stepX / 2;
      const y = padding.top + chartH - (d.cost / maxCost) * chartH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 3. Draw Points & X labels
    ctx.textAlign = 'center';
    data.forEach((d, idx) => {
      const x = padding.left + idx * stepX + stepX / 2;
      const y = padding.top + chartH - (d.cost / maxCost) * chartH;

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();

      // Show dates every few steps
      if (idx % Math.ceil(data.length / 6) === 0 || idx === data.length - 1) {
        const dt = new Date(d.timestamp);
        const label = `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`;
        ctx.fillStyle = textColor;
        ctx.fillText(label, x, height - padding.bottom + 18);
      }
    });
  }

  function renderModelDistChart() {
    const canvas = el.chartModelDist;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.parentElement.clientWidth;
    const height = canvas.parentElement.clientHeight;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const models = (state.analyticsOverview && state.analyticsOverview.models ? state.analyticsOverview.models : [])
      .filter(m => m.model !== '(not set)' && m.totalCost > 0)
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 5);

    if (models.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No model spend data recorded yet', width / 2, height / 2);
      return;
    }

    const maxModelCost = Math.max(...models.map(m => m.totalCost), 0.0001);
    const rowH = Math.min((height - 20) / models.length, 45);
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f8fafc' : '#0f172a';
    const barBg = isDark ? '#1e293b' : '#f1f5f9';

    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4'];

    models.forEach((m, idx) => {
      const y = 15 + idx * rowH;

      // Model name
      ctx.fillStyle = textColor;
      ctx.font = '600 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(m.model, 10, y + 12);

      // Spend amount
      ctx.textAlign = 'right';
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(formatMoney(m.totalCost, 4), width - 10, y + 12);

      // Bar track
      const barY = y + 18;
      const barW = width - 20;
      ctx.fillStyle = barBg;
      ctx.beginPath();
      ctx.roundRect(10, barY, barW, 8, 4);
      ctx.fill();

      // Filled bar
      const fillW = Math.max(12, (m.totalCost / maxModelCost) * barW);
      ctx.fillStyle = colors[idx % colors.length];
      ctx.beginPath();
      ctx.roundRect(10, barY, fillW, 8, 4);
      ctx.fill();
    });
  }

  // ==================== TAB 2: MODEL PRICE LISTS (KVM) ====================

  async function loadPrices(forceRefresh = false) {
    const env = state.selectedEnv;
    el.activePriceEnv.textContent = env;
    const cacheKey = `prices_${env}`;

    let hasCached = false;
    if (!forceRefresh) {
      const cached = Cache.get(cacheKey);
      if (cached && cached.prices) {
        hasCached = true;
        state.prices = cached.prices || {};
        state.pricesModified = false;
        el.kvmStatusBadge.textContent = cached.exists ? 'Synced' : 'Template (Not in KVM)';
        el.kvmStatusBadge.className = cached.exists ? 'badge badge-green' : 'badge badge-yellow';
        el.kvmStatusDot.style.backgroundColor = cached.exists ? 'var(--success)' : 'var(--warning)';
        renderPriceTable();
      }
    }

    try {
      const resp = await fetch(`/api/prices?env=${encodeURIComponent(env)}`);
      if (!resp.ok) throw new Error('Failed to load prices');
      const data = await resp.json();

      const freshPrices = data.prices || {};
      const changed = JSON.stringify(freshPrices) !== JSON.stringify(state.prices) || (data.exists !== (el.kvmStatusBadge.textContent === 'Synced'));

      state.prices = freshPrices;
      state.pricesModified = false;

      el.kvmStatusBadge.textContent = data.exists ? 'Synced' : 'Template (Not in KVM)';
      el.kvmStatusBadge.className = data.exists ? 'badge badge-green' : 'badge badge-yellow';
      el.kvmStatusDot.style.backgroundColor = data.exists ? 'var(--success)' : 'var(--warning)';

      Cache.set(cacheKey, { prices: state.prices, exists: data.exists });

      if (!hasCached || changed) {
        renderPriceTable();
      }
    } catch (err) {
      if (!hasCached) {
        showToast('Error loading price list: ' + err.message, 'error');
      }
    }
  }

  function renderPriceTable() {
    const q = (el.priceSearch.value || '').toLowerCase().trim();
    const models = Object.keys(state.prices).filter(m => !q || m.toLowerCase().includes(q));

    el.modelCount.textContent = Object.keys(state.prices).length;

    if (models.length === 0) {
      el.priceTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No model prices found</td></tr>`;
      return;
    }

    // Put "default" first, then sort alphabetically
    models.sort((a, b) => {
      if (a === 'default') return -1;
      if (b === 'default') return 1;
      return a.localeCompare(b);
    });

    el.priceTableBody.innerHTML = models.map(m => {
      const p = state.prices[m];
      const req = p.requestPerMillionTokens || 0;
      const resp = p.responsePerMillionTokens || 0;
      const cached = p.cachedRequestPerMillionTokens !== undefined ? p.cachedRequestPerMillionTokens : null;
      const blended = calcBlended(req, resp);

      const isDefault = m === 'default';
      const nameBadge = isDefault
        ? `<span class="badge badge-purple" style="font-size: 0.8rem;">default (fallback)</span>`
        : `<strong>${escapeHtml(m)}</strong>`;

      return `
        <tr>
          <td>${nameBadge}</td>
          <td>${formatMoney(req, 4)} / 1M</td>
          <td>${formatMoney(resp, 4)} / 1M</td>
          <td>${cached !== null ? formatMoney(cached, 4) + ' / 1M' : '<span style="color: var(--text-muted);">-</span>'}</td>
          <td><strong style="color: var(--brand-primary);">${formatMoney(blended, 4)} / 1M</strong></td>
          <td style="text-align: right;">
            <button class="btn btn-secondary btn-sm" onclick="window.editModelPrice('${escapeHtml(m)}')">Edit</button>
            ${!isDefault ? `<button class="btn btn-danger btn-sm" onclick="window.deleteModelPrice('${escapeHtml(m)}')">Delete</button>` : ''}
          </td>
        </tr>
      `;
    }).join('');
  }

  window.editModelPrice = function (modelName) {
    const p = state.prices[modelName] || { requestPerMillionTokens: 1.0, responsePerMillionTokens: 3.0 };
    el.priceModelName.value = modelName;
    el.priceModelName.readOnly = (modelName === 'default');
    el.priceReq.value = p.requestPerMillionTokens || 0;
    el.priceResp.value = p.responsePerMillionTokens || 0;
    el.priceCached.value = p.cachedRequestPerMillionTokens !== undefined ? p.cachedRequestPerMillionTokens : '';

    updateBlendedPreview();
    el.modalModelPrice.showModal();
  };

  window.deleteModelPrice = function (modelName) {
    if (modelName === 'default') {
      showToast('Cannot delete default price configuration', 'error');
      return;
    }
    if (confirm(`Remove pricing for model "${modelName}"?`)) {
      delete state.prices[modelName];
      state.pricesModified = true;
      markKvmUnsaved();
      renderPriceTable();
      showToast(`Removed "${modelName}". Click "Save & Deploy" to commit changes.`, 'info');
    }
  };

  function updateBlendedPreview() {
    const req = parseFloat(el.priceReq.value) || 0;
    const resp = parseFloat(el.priceResp.value) || 0;
    const blended = calcBlended(req, resp);
    el.pricePreviewBlended.textContent = formatMoney(blended, 4);
  }

  el.priceReq.addEventListener('input', updateBlendedPreview);
  el.priceResp.addEventListener('input', updateBlendedPreview);

  el.btnOpenAddModel.addEventListener('click', () => {
    el.priceModelName.value = '';
    el.priceModelName.readOnly = false;
    el.priceReq.value = '1.0';
    el.priceResp.value = '3.0';
    el.priceCached.value = '';
    updateBlendedPreview();
    el.modalModelPrice.showModal();
  });

  el.formModelPrice.addEventListener('submit', (e) => {
    e.preventDefault();
    const model = el.priceModelName.value.trim();
    if (!model) return;

    const reqPrice = parseFloat(el.priceReq.value) || 0;
    const respPrice = parseFloat(el.priceResp.value) || 0;
    const cachedPrice = el.priceCached.value !== '' ? parseFloat(el.priceCached.value) : undefined;

    const entry = {
      requestPerMillionTokens: reqPrice,
      responsePerMillionTokens: respPrice
    };
    if (cachedPrice !== undefined && !isNaN(cachedPrice)) {
      entry.cachedRequestPerMillionTokens = cachedPrice;
    }

    state.prices[model] = entry;
    state.pricesModified = true;
    markKvmUnsaved();
    renderPriceTable();

    el.modalModelPrice.close();
    showToast(`Saved model "${model}". Remember to deploy changes.`, 'success');
  });

  function markKvmUnsaved() {
    el.kvmStatusBadge.textContent = 'Unsaved Changes';
    el.kvmStatusBadge.className = 'badge badge-yellow';
    el.kvmStatusDot.style.backgroundColor = 'var(--warning)';
  }

  // Deploy KVM Modal
  el.btnOpenDeployKvm.addEventListener('click', () => {
    el.deployEnvCheckboxes.innerHTML = `
      <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; font-weight: 600;">
        <input type="checkbox" id="deploy-all-envs" checked>
        All Environments (${state.environments.join(', ')})
      </label>
      <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 0.25rem 0;">
      ${state.environments.map(env => `
        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem;">
          <input type="checkbox" class="env-deploy-cb" value="${env}" checked>
          ${env}
        </label>
      `).join('')}
    `;

    const allCb = document.getElementById('deploy-all-envs');
    const itemCbs = document.querySelectorAll('.env-deploy-cb');

    allCb.addEventListener('change', () => {
      itemCbs.forEach(cb => cb.checked = allCb.checked);
    });

    el.modalDeployKvm.showModal();
  });

  el.formDeployKvm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const allCb = document.getElementById('deploy-all-envs');
    const checked = Array.from(document.querySelectorAll('.env-deploy-cb:checked')).map(cb => cb.value);

    let targetEnvs = checked;
    if (allCb && allCb.checked) targetEnvs = ['all'];

    if (targetEnvs.length === 0) {
      showToast('Select at least one environment', 'error');
      return;
    }

    try {
      const resp = await fetch('/api/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environments: targetEnvs,
          prices: state.prices
        })
      });

      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.error || 'Failed to save prices');
      }

      const res = await resp.json();
      el.modalDeployKvm.close();
      state.pricesModified = false;
      el.kvmStatusBadge.textContent = 'Synced';
      el.kvmStatusBadge.className = 'badge badge-green';
      el.kvmStatusDot.style.backgroundColor = 'var(--success)';

      showToast('Price list saved to KVM AI-Config.PriceList successfully!', 'success');
      loadPrices();
    } catch (err) {
      showToast('Error deploying price list: ' + err.message, 'error');
    }
  });

  // Load Default Prices Button
  if (el.btnLoadDefaults) {
    el.btnLoadDefaults.addEventListener('click', async () => {
      const currentEnv = state.selectedEnv || 'dev';
      const confirmed = confirm(
        `Load list price default data for AI models (including gemini-3.5-flash-lite, gemini-3.8-flash, claude-sonnet-5, claude-opus-5-5, etc.) and save to KVM AI-Config.PriceList in environment "${currentEnv}"?`
      );
      if (!confirmed) return;

      const originalHtml = el.btnLoadDefaults.innerHTML;
      el.btnLoadDefaults.disabled = true;
      el.btnLoadDefaults.classList.add('is-spinning');
      el.btnLoadDefaults.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        Loading Defaults...
      `;

      try {
        const resp = await fetch(`/api/prices/load-defaults?env=${encodeURIComponent(currentEnv)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            environments: [currentEnv]
          })
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.error || errData.message || 'Failed to load default prices');
        }

        const data = await resp.json();
        state.prices = data.prices || {};
        state.pricesModified = false;

        el.kvmStatusBadge.textContent = 'Synced';
        el.kvmStatusBadge.className = 'badge badge-green';
        el.kvmStatusDot.style.backgroundColor = 'var(--success)';

        Cache.set(`prices_${currentEnv}`, { prices: state.prices, exists: true });
        renderPriceTable();

        showToast('Default price list loaded and saved to KVM AI-Config.PriceList successfully!', 'success');
      } catch (err) {
        showToast('Error loading default prices: ' + err.message, 'error');
      } finally {
        el.btnLoadDefaults.disabled = false;
        el.btnLoadDefaults.classList.remove('is-spinning');
        el.btnLoadDefaults.innerHTML = originalHtml;
      }
    });
  }

  // Raw JSON Modal
  el.btnViewRawJson.addEventListener('click', () => {
    el.rawJsonEditor.value = JSON.stringify(state.prices, null, 2);
    el.modalRawJson.showModal();
  });

  el.formRawJson.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(el.rawJsonEditor.value);
      if (typeof parsed !== 'object' || parsed === null) throw new Error('Root must be an object');
      state.prices = parsed;
      state.pricesModified = true;
      markKvmUnsaved();
      renderPriceTable();
      el.modalRawJson.close();
      showToast('Applied JSON to price list', 'success');
    } catch (err) {
      alert('Invalid JSON: ' + err.message);
    }
  });

  // Cost Calculator Modal
  el.btnOpenCalculator.addEventListener('click', () => {
    runCalculator();
    el.modalCalculator.showModal();
  });

  function runCalculator() {
    const promptTokens = parseInt(el.calcPromptTokens.value) || 0;
    const respTokens = parseInt(el.calcRespTokens.value) || 0;

    const models = Object.keys(state.prices);
    if (models.length === 0) {
      el.calcResultsBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">No models configured</td></tr>`;
      return;
    }

    el.calcResultsBody.innerHTML = models.map(m => {
      const p = state.prices[m];
      const pCost = (promptTokens / 1000000.0) * (p.requestPerMillionTokens || 0);
      const rCost = (respTokens / 1000000.0) * (p.responsePerMillionTokens || 0);
      const totCost = pCost + rCost;

      return `
        <tr>
          <td><strong>${escapeHtml(m)}</strong></td>
          <td>${formatMoney(pCost, 4)}</td>
          <td>${formatMoney(rCost, 4)}</td>
          <td><strong style="color: var(--brand-primary);">${formatMoney(totCost, 4)}</strong></td>
        </tr>
      `;
    }).join('');
  }

  el.calcPromptTokens.addEventListener('input', runCalculator);
  el.calcRespTokens.addEventListener('input', runCalculator);

  // ==================== TAB 3: APIGEE PRODUCTS & BUDGETS ====================

  async function loadProducts(forceRefresh = false) {
    const env = state.selectedEnv;
    const cacheKey = `products_${env}`;

    let hasCached = false;
    if (!forceRefresh) {
      const cached = Cache.get(cacheKey);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        hasCached = true;
        state.products = cached;
        renderProducts();
      }
    }

    if (!hasCached) {
      el.productsListContainer.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);"><div class="spinner-sm" style="margin: 0 auto 0.5rem;"></div>Loading products...</div>`;
    }

    if (el.btnRefreshProducts && forceRefresh) {
      el.btnRefreshProducts.classList.add('is-spinning');
    }

    try {
      const resp = await fetch(`/api/products?env=${encodeURIComponent(env)}`);
      if (!resp.ok) throw new Error('Failed to load products');
      const products = await resp.json();
      const freshProducts = products || [];

      const changed = JSON.stringify(freshProducts) !== JSON.stringify(state.products);
      state.products = freshProducts;
      Cache.set(cacheKey, state.products);

      if (!hasCached || changed) {
        renderProducts();
      }
    } catch (err) {
      if (!hasCached) {
        showToast('Error loading products: ' + err.message, 'error');
        el.productsListContainer.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--accent-red);">Failed to load products. ${escapeHtml(err.message)}</div>`;
      }
    } finally {
      if (el.btnRefreshProducts) {
        el.btnRefreshProducts.classList.remove('is-spinning');
      }
    }
  }

  function renderProducts() {
    if (state.products.length === 0) {
      el.productsListContainer.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);">No products found in Apigee organization</div>`;
      return;
    }

    // Sort AI products first
    const sorted = state.products.slice().sort((a, b) => {
      if (a.isAIProduct && !b.isAIProduct) return -1;
      if (!a.isAIProduct && b.isAIProduct) return 1;
      return a.name.localeCompare(b.name);
    });

    el.productsListContainer.innerHTML = sorted.map(p => {
      const isAI = p.isAIProduct;
      const cardClass = isAI ? 'product-card ai-ready' : 'product-card';
      const badge = isAI
        ? `<span class="badge badge-blue">AI LLM Enabled</span>`
        : `<span class="badge badge-gray">Standard API</span>`;

      const envBadges = (p.environments || []).map(e => `<span class="badge badge-gray" style="font-size: 0.7rem;">${e}</span>`).join(' ');

      let totalMonthlyBudgetUSD = 0;
      let totalMonthlyTokens = 0;
      if (isAI && p.modelBudgets && p.modelBudgets.length > 0) {
        p.modelBudgets.forEach(m => {
          const est = parseFloat(m.estimatedUSD) || 0;
          const tokens = parseInt(m.tokenLimit) || 0;
          const interval = parseFloat(m.interval) || 1;
          const unit = (m.timeUnit || 'month').toLowerCase();
          let mult = 1 / (interval > 0 ? interval : 1);
          if (unit === 'day') mult = 30 / (interval > 0 ? interval : 1);
          else if (unit === 'hour') mult = (30 * 24) / (interval > 0 ? interval : 1);
          else if (unit === 'minute') mult = (30 * 24 * 60) / (interval > 0 ? interval : 1);
          totalMonthlyBudgetUSD += est * mult;
          totalMonthlyTokens += tokens * mult;
        });
      } else if (typeof p.totalMonthlyBudgetUSD === 'number' && p.totalMonthlyBudgetUSD > 0) {
        totalMonthlyBudgetUSD = p.totalMonthlyBudgetUSD;
        totalMonthlyTokens = p.totalMonthlyTokens || 0;
      }

      let totalBudgetBannerHtml = '';
      if (isAI && p.modelBudgets && p.modelBudgets.length > 0) {
        totalBudgetBannerHtml = `
          <div class="product-monthly-budget-banner" style="background: var(--bg-card-alt, rgba(26,115,232,0.06)); border: 1px solid var(--border-color); border-left: 3px solid var(--brand-primary); border-radius: var(--radius-sm); padding: 0.65rem 0.85rem; margin: 0.65rem 0; display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-size: 0.68rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px;">
                Total Budget Per Month
              </div>
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
                Across all ${p.modelBudgets.length} model quota${p.modelBudgets.length > 1 ? 's' : ''} &bull; ${formatNumber(Math.round(totalMonthlyTokens))} tokens/mo
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 1.25rem; font-weight: 700; color: var(--brand-primary); line-height: 1.1;">
                ${formatMoney(totalMonthlyBudgetUSD)}
              </div>
              <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 500;">/ month</div>
            </div>
          </div>
        `;
      }

      let modelListHtml = '';
      if (isAI && p.modelBudgets && p.modelBudgets.length > 0) {
        modelListHtml = `
          <div style="margin-top: 0.5rem;">
            <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.4rem;">
              Configured AI Model Budgets:
            </div>
            ${p.modelBudgets.map(m => `
              <div class="model-budget-row">
                <div class="model-budget-top">
                  <span style="display: flex; align-items: center; gap: 0.4rem;">
                    <span class="badge badge-purple" style="font-size: 0.75rem;">${escapeHtml(m.model)}</span>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(m.apiSource || 'Proxy')}</span>
                  </span>
                  <span class="budget-amount">${formatMoney(m.estimatedUSD)} / ${m.interval || '1'} ${m.timeUnit || 'month'}</span>
                </div>
                <div class="budget-figures">
                  <span>Limit: <strong>${formatNumber(m.tokenLimit)} tokens</strong></span>
                  <span>Rate: ${formatMoney(m.blendedRate, 3)}/M</span>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        modelListHtml = `<div style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">No LLM model quotas configured on this product.</div>`;
      }

      return `
        <div class="${cardClass}">
          <div class="product-card-header">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <span class="product-name">${escapeHtml(p.displayName || p.name)}</span>
                ${badge}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">${escapeHtml(p.name)}</div>
              <div class="product-desc">${escapeHtml(p.description || 'No description provided')}</div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
            <span style="font-size: 0.75rem; color: var(--text-muted);">Envs:</span>
            ${envBadges || '<span style="font-size: 0.75rem; color: var(--text-muted);">None</span>'}
          </div>

          ${totalBudgetBannerHtml}

          ${modelListHtml}

          <div style="margin-top: auto; padding-top: 0.75rem; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 0.5rem;">
            <button class="btn btn-primary btn-sm" onclick="window.openEditBudget('${escapeHtml(p.name)}')">
              Manage Budgets
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Edit Product AI Model Budget Modal
  window.openEditBudget = function (prodName) {
    const prod = state.products.find(p => p.name === prodName);
    if (!prod) return;

    state.currentEditingProduct = prod;
    el.budgetProductBadge.textContent = prod.displayName || prod.name;

    // Checkboxes for environments
    el.budgetEnvCheckboxes.innerHTML = state.environments.map(env => {
      const checked = (prod.environments || []).includes(env) ? 'checked' : '';
      return `
        <label style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem;">
          <input type="checkbox" class="budget-deploy-env-cb" value="${env}" ${checked}>
          ${env}
        </label>
      `;
    }).join('');

    renderProductModelEditors();
    el.modalEditBudget.showModal();
  };

  function updateModalTotalMonthlyBudget() {
    if (!el.modalTotalMonthlyBudget) return;
    const cards = el.productModelsContainer.querySelectorAll('.model-editor-card');
    let totalMonthlyUSD = 0;
    cards.forEach(card => {
      const money = parseFloat(card.querySelector('.input-budget-money').value) || 0;
      const interval = parseFloat(card.querySelector('.input-budget-interval').value) || 1;
      const unit = (card.querySelector('.input-budget-unit').value || 'month').toLowerCase();
      let mult = 1 / (interval > 0 ? interval : 1);
      if (unit === 'day') mult = 30 / (interval > 0 ? interval : 1);
      else if (unit === 'hour') mult = (30 * 24) / (interval > 0 ? interval : 1);
      else if (unit === 'minute') mult = (30 * 24 * 60) / (interval > 0 ? interval : 1);
      totalMonthlyUSD += money * mult;
    });
    el.modalTotalMonthlyBudget.textContent = `${formatMoney(totalMonthlyUSD)} / mo`;
  }

  function renderProductModelEditors() {
    const prod = state.currentEditingProduct;
    let models = [];

    if (prod && prod.modelBudgets && prod.modelBudgets.length > 0) {
      models = prod.modelBudgets;
    } else if (prod && prod.llmOperationGroup && prod.llmOperationGroup.operationConfigs) {
      // Parse from llmOperationGroup
      prod.llmOperationGroup.operationConfigs.forEach(cfg => {
        const quota = cfg.LlmTokenQuota || cfg.llmTokenQuota || {};
        (cfg.LlmOperations || cfg.llmOperations || []).forEach(op => {
          models.push({
            model: op.model || op.Model || 'default',
            apiSource: cfg.apiSource || cfg.APISource || 'REST-AI-Completions',
            resource: op.resource || op.Resource || '/',
            methods: op.methods || op.Methods || ['POST'],
            tokenLimit: parseInt(quota.limit || '0'),
            interval: quota.interval || '1',
            timeUnit: quota.timeUnit || 'month'
          });
        });
      });
    }

    if (models.length === 0) {
      // Provide initial default template
      models.push({
        model: 'gemini-1.5-flash',
        apiSource: 'REST-AI-Completions',
        resource: '/',
        methods: ['POST'],
        tokenLimit: 10000000,
        interval: '1',
        timeUnit: 'month'
      });
    }

    el.productModelsContainer.innerHTML = '';
    models.forEach((m, idx) => {
      addModelEditorCard(m, idx);
    });
    updateModalTotalMonthlyBudget();
  }

  function addModelEditorCard(modelData, idx) {
    const card = document.createElement('div');
    card.className = 'model-editor-card model-budget-row';
    card.dataset.index = idx;
    card.dataset.apiSource = modelData.apiSource || 'REST-AI-Completions';
    card.dataset.resource = modelData.resource || '/';
    card.dataset.methods = JSON.stringify(modelData.methods || ['POST']);

    const effPrice = (state.prices && state.prices[modelData.model]) || (state.prices && state.prices['default']) || { requestPerMillionTokens: 1.0, responsePerMillionTokens: 3.0 };
    const blended = calcBlended(effPrice.requestPerMillionTokens, effPrice.responsePerMillionTokens);

    let initialMoney = (modelData.tokenLimit / 1000000.0) * blended;
    initialMoney = Math.round(initialMoney * 100) / 100;

    let modelOptions = '';
    const hasModelInPrices = state.prices && Object.keys(state.prices).includes(modelData.model);
    if (modelData.model && !hasModelInPrices) {
      modelOptions += `<option value="${modelData.model}" selected>${modelData.model}</option>`;
    }
    if (state.prices) {
      modelOptions += Object.keys(state.prices).map(m => {
        const sel = (m === modelData.model && hasModelInPrices) ? 'selected' : '';
        return `<option value="${m}" ${sel}>${m}</option>`;
      }).join('');
    }

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 0.6rem; flex: 1; min-width: 240px;">
          <span class="badge badge-purple" style="font-size: 0.8rem;">Model</span>
          <select class="select-control model-select" style="font-weight: 600; font-size: 0.9rem; flex: 1;">
            ${modelOptions || `<option value="${modelData.model}">${modelData.model}</option>`}
          </select>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span class="conversion-sub" style="font-size: 0.8rem;">
            Rate: <strong class="lbl-model-rate" style="color: var(--brand-primary);">${formatMoney(blended, 3)}/1M</strong>
          </span>
          <button type="button" class="btn btn-danger btn-sm remove-model-btn" title="Remove model">
            &times; Remove
          </button>
        </div>
      </div>

      <div class="model-editor-grid">
        <div>
          <label class="form-label" style="font-size: 0.75rem;">Budget Amount ($ USD)</label>
          <div style="position: relative;">
            <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-weight: 600;">$</span>
            <input type="number" step="0.01" min="0" class="form-input input-budget-money" value="${initialMoney}" style="padding-left: 1.5rem;" placeholder="e.g. 500.00">
          </div>
        </div>
        <div>
          <label class="form-label" style="font-size: 0.75rem;">Token Quota Limit</label>
          <input type="number" min="0" step="1" class="form-input input-budget-tokens" value="${modelData.tokenLimit || 0}" placeholder="e.g. 1904761905">
        </div>
        <div>
          <label class="form-label" style="font-size: 0.75rem;">Quota Interval</label>
          <input type="number" min="1" step="1" class="form-input input-budget-interval" value="${modelData.interval || 1}">
        </div>
        <div>
          <label class="form-label" style="font-size: 0.75rem;">Time Unit</label>
          <select class="select-control input-budget-unit" style="width: 100%;">
            <option value="minute" ${modelData.timeUnit === 'minute' ? 'selected' : ''}>minute</option>
            <option value="hour" ${modelData.timeUnit === 'hour' ? 'selected' : ''}>hour</option>
            <option value="day" ${modelData.timeUnit === 'day' ? 'selected' : ''}>day</option>
            <option value="month" ${modelData.timeUnit === 'month' ? 'selected' : ''}>month</option>
          </select>
        </div>
      </div>
    `;

    // Real-time bidirectional converter!
    const selModel = card.querySelector('.model-select');
    const inputMoney = card.querySelector('.input-budget-money');
    const inputTokens = card.querySelector('.input-budget-tokens');
    const inputInterval = card.querySelector('.input-budget-interval');
    const inputUnit = card.querySelector('.input-budget-unit');
    const lblRate = card.querySelector('.lbl-model-rate');

    function getRate() {
      const m = selModel.value;
      const p = (state.prices && state.prices[m]) || (state.prices && state.prices['default']) || { requestPerMillionTokens: 1.0, responsePerMillionTokens: 3.0 };
      return calcBlended(p.requestPerMillionTokens, p.responsePerMillionTokens);
    }

    // Changing money calculates tokens
    inputMoney.addEventListener('input', () => {
      const money = parseFloat(inputMoney.value) || 0;
      const rate = getRate();
      const tokens = Math.round((money / rate) * 1000000.0);
      inputTokens.value = tokens;
      updateModalTotalMonthlyBudget();
    });

    // Changing tokens calculates money
    inputTokens.addEventListener('input', () => {
      const tokens = parseInt(inputTokens.value) || 0;
      const rate = getRate();
      const money = Math.round(((tokens / 1000000.0) * rate) * 100) / 100;
      inputMoney.value = money;
      updateModalTotalMonthlyBudget();
    });

    // Changing interval or unit recalculates total monthly budget
    inputInterval.addEventListener('input', updateModalTotalMonthlyBudget);
    inputUnit.addEventListener('change', updateModalTotalMonthlyBudget);

    // Changing model recalculates
    selModel.addEventListener('change', () => {
      const rate = getRate();
      lblRate.textContent = formatMoney(rate, 3) + '/M tokens';
      // Recalculate tokens from current money
      const money = parseFloat(inputMoney.value) || 0;
      const tokens = Math.round((money / rate) * 1000000.0);
      inputTokens.value = tokens;
      updateModalTotalMonthlyBudget();
    });

    card.querySelector('.remove-model-btn').addEventListener('click', () => {
      card.remove();
      updateModalTotalMonthlyBudget();
    });

    el.productModelsContainer.appendChild(card);
  }

  el.btnAddModelToProduct.addEventListener('click', () => {
    addModelEditorCard({
      model: Object.keys(state.prices)[0] || 'default',
      apiSource: 'REST-AI-Completions',
      resource: '/',
      methods: ['POST'],
      tokenLimit: 1000000,
      interval: '1',
      timeUnit: 'month'
    }, el.productModelsContainer.children.length);
    updateModalTotalMonthlyBudget();
  });

  el.formEditBudget.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.currentEditingProduct) return;

    const cards = el.productModelsContainer.querySelectorAll('.model-editor-card, .model-budget-row');
    if (cards.length === 0) {
      showToast('Cannot save empty budget: please configure at least one model quota.', 'error');
      return;
    }

    const updatedModels = [];

    cards.forEach(card => {
      const model = card.querySelector('.model-select').value;
      const tokens = parseInt(card.querySelector('.input-budget-tokens').value) || 0;
      const money = parseFloat(card.querySelector('.input-budget-money').value) || 0;
      const interval = card.querySelector('.input-budget-interval').value || '1';
      const timeUnit = card.querySelector('.input-budget-unit').value || 'month';
      const apiSource = card.dataset.apiSource || 'REST-AI-Completions';
      const resource = card.dataset.resource || '/';
      let methods = ['POST'];
      try { methods = JSON.parse(card.dataset.methods || '["POST"]'); } catch(e){}

      updatedModels.push({
        model: model,
        apiSource: apiSource,
        resource: resource,
        methods: methods,
        tokenLimit: tokens,
        estimatedUSD: money,
        interval: interval,
        timeUnit: timeUnit
      });
    });

    const targetEnvs = Array.from(document.querySelectorAll('.budget-deploy-env-cb:checked')).map(cb => cb.value);

    try {
      const resp = await fetch(`/api/products/${encodeURIComponent(state.currentEditingProduct.name)}/budget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environment: state.selectedEnv,
          deployToEnvironments: targetEnvs,
          models: updatedModels
        })
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Failed to update product');
      }

      el.modalEditBudget.close();
      showToast('Product AI model budgets updated successfully!', 'success');
      loadProducts(true);
    } catch (err) {
      showToast('Error updating budget: ' + err.message, 'error');
    }
  });

  // Create Product Modal
  el.btnOpenCreateProduct.addEventListener('click', () => {
    el.newProdName.value = '';
    el.newProdDisplay.value = '';
    el.newProdDesc.value = '';
    el.newProdProxy.value = 'REST-AI-Completions';

    el.newProdEnvCheckboxes.innerHTML = state.environments.map(env => `
      <label style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem;">
        <input type="checkbox" class="new-prod-env-cb" value="${env}" checked>
        ${env}
      </label>
    `).join('');

    el.newProdModelsList.innerHTML = '';
    addInitialModelRow('gemini-1.5-flash', 10000000);
    el.modalCreateProduct.showModal();
  });

  function addInitialModelRow(defaultModel, defaultTokens) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '0.5rem';
    row.style.alignItems = 'center';

    const modelOptions = Object.keys(state.prices).map(m => {
      const sel = m === defaultModel ? 'selected' : '';
      return `<option value="${m}" ${sel}>${m}</option>`;
    }).join('');

    row.innerHTML = `
      <select class="select-control new-row-model" style="flex: 1;">
        ${modelOptions || `<option value="${defaultModel}">${defaultModel}</option>`}
      </select>
      <input type="number" class="form-input new-row-tokens" value="${defaultTokens}" placeholder="Token limit" style="flex: 1;">
      <button type="button" class="btn btn-secondary btn-sm" onclick="this.parentElement.remove()">&times;</button>
    `;
    el.newProdModelsList.appendChild(row);
  }

  el.btnAddInitialModel.addEventListener('click', () => {
    addInitialModelRow(Object.keys(state.prices)[0] || 'default', 1000000);
  });

  el.formCreateProduct.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = el.newProdName.value.trim();
    const displayName = el.newProdDisplay.value.trim();
    const description = el.newProdDesc.value.trim();
    const proxy = el.newProdProxy.value.trim() || 'REST-AI-Completions';

    const envs = Array.from(document.querySelectorAll('.new-prod-env-cb:checked')).map(cb => cb.value);

    // Build operation configs
    const rows = el.newProdModelsList.querySelectorAll('div');
    const opConfigs = [];

    rows.forEach(r => {
      const model = r.querySelector('.new-row-model').value;
      const tokens = r.querySelector('.new-row-tokens').value || '1000000';
      opConfigs.push({
        apiSource: proxy,
        llmOperations: [{ resource: '/', model: model, methods: ['POST'] }],
        llmTokenQuota: { limit: tokens, interval: '1', timeUnit: 'month' }
      });
    });

    const productPayload = {
      name: name,
      displayName: displayName,
      description: description,
      approvalType: 'auto',
      environments: envs,
      attributes: [{ name: 'access', value: 'public' }],
      llmOperationGroup: {
        operationConfigs: opConfigs
      }
    };

    try {
      const resp = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productPayload)
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Failed to create product');
      }

      el.modalCreateProduct.close();
      showToast(`Product "${name}" created successfully!`, 'success');
      loadProducts(true);
    } catch (err) {
      showToast('Error creating product: ' + err.message, 'error');
    }
  });

  // ================= DEVELOPERS & USERS MANAGEMENT =================

  function setDevelopersLoading(isLoading, isBackground = false, isUserInitiated = false) {
    if (el.btnRefreshDevelopers) {
      if (isLoading && isUserInitiated) {
        el.btnRefreshDevelopers.disabled = true;
        el.btnRefreshDevelopers.classList.add('is-spinning');
        if (el.btnRefreshDevText) el.btnRefreshDevText.textContent = 'Updating...';
      } else {
        el.btnRefreshDevelopers.disabled = false;
        el.btnRefreshDevelopers.classList.remove('is-spinning');
        if (el.btnRefreshDevText) el.btnRefreshDevText.textContent = 'Refresh';
      }
    }
  }

  async function loadDevelopers(forceRefresh = false) {
    const env = state.selectedEnv;
    const timeRange = getTimeRangeParam();
    const cacheKey = `developers_${env}_${state.timeRange}`;

    let hasCached = false;
    if (!forceRefresh) {
      const cached = Cache.get(cacheKey);
      if (cached && cached.developers) {
        hasCached = true;
        state.developers = cached.developers || [];
        if (el.valTotalDevs) el.valTotalDevs.textContent = (cached.totalDevelopers || state.developers.length).toLocaleString();
        if (el.valTotalApps) el.valTotalApps.textContent = (cached.totalApps || 0).toLocaleString();
        if (el.valTotalDevSpend) el.valTotalDevSpend.textContent = `$${(cached.totalSpend || 0).toFixed(4)}`;
        if (el.valTotalDevTokens) el.valTotalDevTokens.textContent = (cached.totalTokens || 0).toLocaleString();
        if (el.badgeDevCount) el.badgeDevCount.textContent = `${state.developers.length} Developers`;
        renderDevelopersTable();
      }
    }

    setDevelopersLoading(true, hasCached, forceRefresh);

    if (!hasCached && el.tbodyDevelopers) {
      el.tbodyDevelopers.innerHTML = `
        <tr><td colspan="7" style="padding: 1.5rem; text-align: center;"><div class="skeleton-bar" style="height: 20px; width: 60%; margin: 0 auto 0.5rem;"></div><div class="skeleton-bar" style="height: 14px; width: 40%; margin: 0 auto;"></div></td></tr>
      `;
    }

    try {
      const url = `/api/developers?env=${encodeURIComponent(env)}&timeRange=${encodeURIComponent(timeRange)}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch developers');
      }

      const data = await resp.json();
      const freshDevs = data.developers || [];

      const changed = JSON.stringify(freshDevs) !== JSON.stringify(state.developers);
      state.developers = freshDevs;

      if (el.valTotalDevs) el.valTotalDevs.textContent = (data.totalDevelopers || state.developers.length).toLocaleString();
      if (el.valTotalApps) el.valTotalApps.textContent = (data.totalApps || 0).toLocaleString();
      if (el.valTotalDevSpend) el.valTotalDevSpend.textContent = `$${(data.totalSpend || 0).toFixed(4)}`;
      if (el.valTotalDevTokens) el.valTotalDevTokens.textContent = (data.totalTokens || 0).toLocaleString();
      if (el.badgeDevCount) el.badgeDevCount.textContent = `${state.developers.length} Developers`;

      Cache.set(cacheKey, {
        developers: state.developers,
        totalDevelopers: data.totalDevelopers,
        totalApps: data.totalApps,
        totalSpend: data.totalSpend,
        totalTokens: data.totalTokens
      });

      if (!hasCached || changed) {
        renderDevelopersTable();
      }
    } catch (err) {
      if (!hasCached) {
        showToast('Error loading developers: ' + err.message, 'error');
        if (el.tbodyDevelopers) {
          el.tbodyDevelopers.innerHTML = `
            <tr><td colspan="7" style="text-align: center; color: var(--accent-red); padding: 1.5rem;">Failed to load developers. ${escapeHtml(err.message)}</td></tr>
          `;
        }
      }
    } finally {
      setDevelopersLoading(false);
    }
  }

  function renderDevelopersTable() {
    if (!el.tbodyDevelopers) return;
    const filter = (el.inputSearchDevs ? el.inputSearchDevs.value.toLowerCase().trim() : '');

    const filtered = state.developers.filter(d => {
      if (!filter) return true;
      const email = (d.email || '').toLowerCase();
      const fn = (d.firstName || '').toLowerCase();
      const ln = (d.lastName || '').toLowerCase();
      const un = (d.userName || '').toLowerCase();
      const apps = (d.apps || []).join(' ').toLowerCase();
      return email.includes(filter) || fn.includes(filter) || ln.includes(filter) || un.includes(filter) || apps.includes(filter);
    });

    if (el.badgeDevCount) {
      el.badgeDevCount.textContent = filter ? `${filtered.length} of ${state.developers.length} Developers` : `${state.developers.length} Developers`;
    }

    if (filtered.length === 0) {
      el.tbodyDevelopers.innerHTML = `
        <tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No developers matching query</td></tr>
      `;
      return;
    }

    el.tbodyDevelopers.innerHTML = filtered.map(d => {
      const email = d.email || '';
      const fn = d.firstName || '';
      const ln = d.lastName || '';
      const fullName = (fn || ln) ? `${fn} ${ln}`.trim() : email.split('@')[0];
      const initials = (fn && ln) ? `${fn[0]}${ln[0]}`.toUpperCase() : (fullName.slice(0, 2)).toUpperCase();
      const appsCount = (d.apps || []).length;
      const spend = d.totalSpend || 0;
      const tokens = d.totalTokens || 0;
      const calls = d.totalCalls || 0;
      const status = d.status || 'active';
      const statusClass = status.toLowerCase() === 'active' ? 'badge-green' : 'badge-yellow';

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="dev-avatar">${escapeHtml(initials)}</div>
              <div>
                <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${escapeHtml(fullName)}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(email)}</div>
              </div>
            </div>
          </td>
          <td><span class="badge ${statusClass}">${escapeHtml(status)}</span></td>
          <td>
            <span class="badge ${appsCount > 0 ? 'badge-blue' : 'badge-gray'}">${appsCount} App${appsCount === 1 ? '' : 's'}</span>
          </td>
          <td>
            <strong style="color: ${spend > 0 ? 'var(--brand-primary)' : 'var(--text-secondary)'}; font-size: 0.9rem;">
              $${spend.toFixed(4)}
            </strong>
          </td>
          <td>
            <span style="font-family: monospace; font-size: 0.85rem; color: var(--text-primary);">${tokens.toLocaleString()}</span>
          </td>
          <td>
            <span style="font-size: 0.85rem; color: var(--text-secondary);">${calls.toLocaleString()}</span>
          </td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 0.4rem;">
              <button class="btn btn-secondary btn-sm btn-manage-dev-apps" data-email="${escapeHtml(email)}" title="Manage Apps and API Keys">
                Manage Apps & Keys
              </button>
              <button class="btn btn-secondary btn-sm btn-delete-dev" data-email="${escapeHtml(email)}" title="Delete Developer" style="color: var(--accent-red);">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    el.tbodyDevelopers.querySelectorAll('.btn-manage-dev-apps').forEach(btn => {
      btn.addEventListener('click', () => {
        const email = btn.getAttribute('data-email');
        openDeveloperDetail(email);
      });
    });

    el.tbodyDevelopers.querySelectorAll('.btn-delete-dev').forEach(btn => {
      btn.addEventListener('click', () => {
        const email = btn.getAttribute('data-email');
        deleteDeveloper(email);
      });
    });
  }

  async function openDeveloperDetail(email) {
    state.selectedDeveloper = email;
    const dev = state.developers.find(d => d.email === email);
    const fullName = dev ? ((dev.firstName || dev.lastName) ? `${dev.firstName || ''} ${dev.lastName || ''}`.trim() : email) : email;

    if (el.modalDevSubtitle) {
      el.modalDevSubtitle.textContent = `${fullName} (${email})`;
    }

    if (el.devDetailBanner) {
      const spend = dev ? (dev.totalSpend || 0) : 0;
      const tokens = dev ? (dev.totalTokens || 0) : 0;
      const calls = dev ? (dev.totalCalls || 0) : 0;
      el.devDetailBanner.innerHTML = `
        <div class="metric-chip accent">
          <span>AI Cost:</span>
          <strong>$${spend.toFixed(4)}</strong>
        </div>
        <div class="metric-chip">
          <span>Tokens Consumed:</span>
          <strong>${tokens.toLocaleString()}</strong>
        </div>
        <div class="metric-chip">
          <span>Total API Calls:</span>
          <strong>${calls.toLocaleString()}</strong>
        </div>
        <div class="metric-chip">
          <span>Environment:</span>
          <strong>${escapeHtml(state.selectedEnv)}</strong>
        </div>
      `;
    }

    if (el.modalDeveloperDetail && typeof el.modalDeveloperDetail.showModal === 'function') {
      el.modalDeveloperDetail.showModal();
    }
    await loadDeveloperApps(email);
  }

  async function loadDeveloperApps(email, forceRefresh = false) {
    const env = state.selectedEnv;
    const timeRange = getTimeRangeParam();
    const cacheKey = `dev_apps_${email}_${env}_${state.timeRange}`;

    let hasCached = false;
    if (!forceRefresh) {
      const cached = Cache.get(cacheKey);
      if (cached && cached.apps) {
        hasCached = true;
        state.selectedDeveloperApps = cached.apps || [];
        if (el.devDetailBanner && cached.totalSpend !== undefined) {
          el.devDetailBanner.innerHTML = `
            <div class="metric-chip accent">
              <span>AI Cost:</span>
              <strong>$${(cached.totalSpend || 0).toFixed(4)}</strong>
            </div>
            <div class="metric-chip">
              <span>Tokens Consumed:</span>
              <strong>${(cached.totalTokens || 0).toLocaleString()}</strong>
            </div>
            <div class="metric-chip">
              <span>Registered Apps:</span>
              <strong>${state.selectedDeveloperApps.length}</strong>
            </div>
            <div class="metric-chip">
              <span>Environment:</span>
              <strong>${escapeHtml(env)}</strong>
            </div>
          `;
        }
        renderDeveloperApps(state.selectedDeveloperApps);
      }
    }

    if (el.devAppsLoading) el.devAppsLoading.style.display = hasCached ? 'none' : 'block';
    if (!hasCached && el.devAppsEmpty) el.devAppsEmpty.style.display = 'none';

    try {
      const url = `/api/developers/apps?email=${encodeURIComponent(email)}&env=${encodeURIComponent(env)}&timeRange=${encodeURIComponent(timeRange)}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch developer apps');
      }

      const data = await resp.json();
      const freshApps = data.apps || [];
      const changed = JSON.stringify(freshApps) !== JSON.stringify(state.selectedDeveloperApps);
      state.selectedDeveloperApps = freshApps;

      if (el.devDetailBanner && data.totalSpend !== undefined) {
        const spend = data.totalSpend || 0;
        const tokens = data.totalTokens || 0;
        el.devDetailBanner.innerHTML = `
          <div class="metric-chip accent">
            <span>AI Cost:</span>
            <strong>$${spend.toFixed(4)}</strong>
          </div>
          <div class="metric-chip">
            <span>Tokens Consumed:</span>
            <strong>${tokens.toLocaleString()}</strong>
          </div>
          <div class="metric-chip">
            <span>Registered Apps:</span>
            <strong>${state.selectedDeveloperApps.length}</strong>
          </div>
          <div class="metric-chip">
            <span>Environment:</span>
            <strong>${escapeHtml(env)}</strong>
          </div>
        `;
      }

      Cache.set(cacheKey, {
        apps: state.selectedDeveloperApps,
        totalSpend: data.totalSpend,
        totalTokens: data.totalTokens
      });

      if (!hasCached || changed) {
        renderDeveloperApps(state.selectedDeveloperApps);
      }
    } catch (err) {
      if (!hasCached) {
        showToast('Error loading developer apps: ' + err.message, 'error');
        if (el.devAppsContainer) {
          el.devAppsContainer.innerHTML = `
            <div style="padding: 1.5rem; text-align: center; color: var(--accent-red); background: var(--bg-card); border-radius: var(--radius-sm);">
              Failed to load apps: ${escapeHtml(err.message)}
            </div>
          `;
        }
      }
    } finally {
      if (el.devAppsLoading) el.devAppsLoading.style.display = 'none';
    }
  }

  function renderDeveloperApps(apps) {
    if (!el.devAppsContainer) return;

    if (!apps || apps.length === 0) {
      if (el.devAppsEmpty) el.devAppsEmpty.style.display = 'block';
      el.devAppsContainer.innerHTML = '';
      return;
    }
    if (el.devAppsEmpty) el.devAppsEmpty.style.display = 'none';

    const aiProductNames = new Set((state.products || []).filter(p => p.hasLlmConfig).map(p => p.name));

    el.devAppsContainer.innerHTML = apps.map(app => {
      const appName = app.name || '';
      const spend = app.totalSpend || 0;
      const tokens = app.totalTokens || 0;
      const calls = app.totalCalls || 0;
      const status = app.status || 'approved';
      const statusBadge = status.toLowerCase() === 'approved' ? 'badge-green' : 'badge-yellow';
      const creds = app.credentials || [];

      const credsHtml = creds.length === 0 ? `
        <div style="font-size: 0.8rem; color: var(--text-muted); font-style: italic; padding: 0.5rem 0;">No API credentials issued.</div>
      ` : creds.map(c => {
        const cKey = c.consumerKey || '';
        const cSecret = c.consumerSecret || '';
        const cSpend = c.totalSpend || 0;
        const cTokens = c.totalTokens || 0;
        const cCalls = c.totalCalls || 0;
        const products = c.apiProducts || [];
        const isApproved = (c.status || '').toLowerCase() === 'approved';

        const productsTagsHtml = products.length === 0 ? `
          <span style="font-size: 0.75rem; color: var(--text-muted);">No product subscriptions</span>
        ` : products.map(p => {
          const pName = p.apiproduct || '';
          const isAI = aiProductNames.has(pName) || pName.toLowerCase().includes('ai');
          return `
            <span class="product-tag ${isAI ? 'ai-product' : ''}" title="${isAI ? 'AI Model Product' : 'Standard Product'}">
              ${isAI ? '✨ ' : ''}${escapeHtml(pName)}
            </span>
          `;
        }).join('');

        return `
          <div class="dev-cred-box">
            <div class="dev-cred-top">
              <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
                <span class="badge ${isApproved ? 'badge-green' : 'badge-red'}" style="font-size: 0.7rem;">${escapeHtml(c.status || 'approved')}</span>
                <div class="dev-cred-key-group" title="API Key / Consumer Key">
                  <span>${escapeHtml(cKey)}</span>
                  <button type="button" class="btn-icon-xs btn-copy" data-copy="${escapeHtml(cKey)}" title="Copy Consumer Key">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  </button>
                </div>
                <div class="dev-cred-secret-group" title="Consumer Secret">
                  <span class="secret-text" data-secret="${escapeHtml(cSecret)}">••••••••••••••••</span>
                  <button type="button" class="btn-icon-xs btn-toggle-secret" title="Toggle Secret Visibility">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  </button>
                  <button type="button" class="btn-icon-xs btn-copy" data-copy="${escapeHtml(cSecret)}" title="Copy Secret">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  </button>
                </div>
              </div>

              <!-- Credential Analytics Chips -->
              <div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
                <span class="metric-chip accent" style="font-size: 0.725rem;">
                  Cost: <strong>$${cSpend.toFixed(4)}</strong>
                </span>
                <span class="metric-chip" style="font-size: 0.725rem;">
                  Tokens: <strong>${cTokens.toLocaleString()}</strong>
                </span>
                <span class="metric-chip" style="font-size: 0.725rem;">
                  Calls: <strong>${cCalls.toLocaleString()}</strong>
                </span>
              </div>
            </div>

            <!-- Subscribed Products & Actions Row -->
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.25rem;">
              <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">Subscriptions:</span>
                ${productsTagsHtml}
              </div>
              <div style="display: flex; gap: 0.4rem; align-items: center;">
                <button type="button" class="btn btn-secondary btn-sm btn-manage-sub" data-app="${escapeHtml(appName)}" data-key="${escapeHtml(cKey)}" style="font-size: 0.75rem; padding: 0.25rem 0.6rem;">
                  Edit Subscriptions
                </button>
                <button type="button" class="btn btn-secondary btn-sm btn-revoke-key" data-app="${escapeHtml(appName)}" data-key="${escapeHtml(cKey)}" title="Revoke and Delete Key" style="color: var(--accent-red); font-size: 0.75rem; padding: 0.25rem 0.6rem;">
                  Revoke
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="dev-app-card">
          <div class="dev-app-header">
            <div class="dev-app-title-row">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--brand-primary);"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
              <span class="dev-app-name">${escapeHtml(appName)}</span>
              <span class="badge ${statusBadge}">${escapeHtml(status)}</span>
            </div>

            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <button type="button" class="btn btn-secondary btn-sm btn-gen-key" data-app="${escapeHtml(appName)}" style="font-size: 0.75rem;">
                + Add Key
              </button>
              <button type="button" class="btn btn-secondary btn-sm btn-delete-app" data-app="${escapeHtml(appName)}" style="color: var(--accent-red); font-size: 0.75rem;">
                Delete App
              </button>
            </div>
          </div>

          <div class="dev-app-metrics-chips">
            <div class="metric-chip accent">
              <span>App Total Spend:</span>
              <strong>$${spend.toFixed(4)}</strong>
            </div>
            <div class="metric-chip">
              <span>App Total Tokens:</span>
              <strong>${tokens.toLocaleString()}</strong>
            </div>
            <div class="metric-chip">
              <span>App Total Calls:</span>
              <strong>${calls.toLocaleString()}</strong>
            </div>
            <div class="metric-chip">
              <span>Keys Count:</span>
              <strong>${creds.length}</strong>
            </div>
          </div>

          <div class="dev-cred-container">
            <div style="font-size: 0.785rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em;">
              Credentials & Subscriptions
            </div>
            ${credsHtml}
          </div>
        </div>
      `;
    }).join('');

    el.devAppsContainer.querySelectorAll('.btn-gen-key').forEach(btn => {
      btn.addEventListener('click', () => {
        const appName = btn.getAttribute('data-app');
        createAppKey(appName);
      });
    });

    el.devAppsContainer.querySelectorAll('.btn-delete-app').forEach(btn => {
      btn.addEventListener('click', () => {
        const appName = btn.getAttribute('data-app');
        deleteApp(appName);
      });
    });

    el.devAppsContainer.querySelectorAll('.btn-manage-sub').forEach(btn => {
      btn.addEventListener('click', () => {
        const appName = btn.getAttribute('data-app');
        const key = btn.getAttribute('data-key');
        openManageSubscriptionsModal(appName, key);
      });
    });

    el.devAppsContainer.querySelectorAll('.btn-revoke-key').forEach(btn => {
      btn.addEventListener('click', () => {
        const appName = btn.getAttribute('data-app');
        const key = btn.getAttribute('data-key');
        deleteAppKey(appName, key);
      });
    });

    el.devAppsContainer.querySelectorAll('.btn-copy').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-copy');
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(() => {
            showToast('Copied to clipboard!', 'info');
          });
        }
      });
    });

    el.devAppsContainer.querySelectorAll('.btn-toggle-secret').forEach(btn => {
      btn.addEventListener('click', () => {
        const group = btn.closest('.dev-cred-secret-group');
        const span = group ? group.querySelector('.secret-text') : null;
        if (!span) return;
        const secret = span.getAttribute('data-secret');
        if (span.textContent === '••••••••••••••••') {
          span.textContent = secret;
          btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
        } else {
          span.textContent = '••••••••••••••••';
          btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        }
      });
    });
  }

  function openCreateDeveloperModal() {
    if (el.formCreateDeveloper) el.formCreateDeveloper.reset();
    if (el.modalCreateDeveloper && typeof el.modalCreateDeveloper.showModal === 'function') {
      el.modalCreateDeveloper.showModal();
    }
  }

  async function handleCreateDeveloper(event) {
    event.preventDefault();
    const email = (el.newDevEmail ? el.newDevEmail.value.trim() : '');
    const firstName = (el.newDevFirstname ? el.newDevFirstname.value.trim() : '');
    const lastName = (el.newDevLastname ? el.newDevLastname.value.trim() : '');
    const userName = (el.newDevUsername ? el.newDevUsername.value.trim() : '') || email;

    if (!email) {
      showToast('Email address is required', 'error');
      return;
    }

    try {
      const resp = await fetch('/api/developers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, firstName, lastName, userName })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create developer');
      }

      if (el.modalCreateDeveloper) el.modalCreateDeveloper.close();
      showToast(`Developer "${email}" created successfully!`, 'success');
      loadDevelopers(true);
    } catch (err) {
      showToast('Error creating developer: ' + err.message, 'error');
    }
  }

  async function deleteDeveloper(email) {
    if (!confirm(`Are you sure you want to delete developer "${email}" and all their registered apps?`)) {
      return;
    }

    try {
      const resp = await fetch(`/api/developers/single?email=${encodeURIComponent(email)}`, {
        method: 'DELETE'
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete developer');
      }

      showToast(`Developer "${email}" deleted successfully`, 'success');
      if (state.selectedDeveloper === email && el.modalDeveloperDetail) {
        el.modalDeveloperDetail.close();
      }
      loadDevelopers(true);
    } catch (err) {
      showToast('Error deleting developer: ' + err.message, 'error');
    }
  }

  async function openCreateAppModal() {
    if (!state.selectedDeveloper) return;
    if (el.createAppDevEmail) el.createAppDevEmail.value = state.selectedDeveloper;
    if (el.createAppName) el.createAppName.value = '';

    if (el.createAppProductsList) {
      if (!state.products || state.products.length === 0) {
        await loadProducts();
      }

      el.createAppProductsList.innerHTML = (state.products || []).map(p => {
        const isAI = p.hasLlmConfig || p.name.toLowerCase().includes('ai');
        return `
          <div class="sub-product-item">
            <label>
              <input type="checkbox" name="create-app-product" value="${escapeHtml(p.name)}" ${isAI ? 'checked' : ''}>
              <span style="font-weight: 500; font-size: 0.85rem;">${escapeHtml(p.displayName || p.name)}</span>
            </label>
            ${isAI ? '<span class="badge badge-purple" style="font-size: 0.7rem;">AI Model</span>' : ''}
          </div>
        `;
      }).join('');
    }

    if (el.modalCreateApp && typeof el.modalCreateApp.showModal === 'function') {
      el.modalCreateApp.showModal();
    }
  }

  async function handleCreateApp(event) {
    event.preventDefault();
    if (!state.selectedDeveloper) return;

    const name = (el.createAppName ? el.createAppName.value.trim() : '');
    if (!name) {
      showToast('App name is required', 'error');
      return;
    }

    const selectedProducts = [];
    if (el.createAppProductsList) {
      el.createAppProductsList.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        selectedProducts.push(cb.value);
      });
    }

    try {
      const resp = await fetch(`/api/developers/apps?email=${encodeURIComponent(state.selectedDeveloper)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, apiProducts: selectedProducts })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create app');
      }

      if (el.modalCreateApp) el.modalCreateApp.close();
      showToast(`App "${name}" created successfully!`, 'success');
      loadDeveloperApps(state.selectedDeveloper, true);
      loadDevelopers(true);
    } catch (err) {
      showToast('Error creating app: ' + err.message, 'error');
    }
  }

  async function deleteApp(appName) {
    if (!state.selectedDeveloper) return;
    if (!confirm(`Are you sure you want to delete app "${appName}" and all its API credentials?`)) {
      return;
    }

    try {
      const resp = await fetch(`/api/developers/apps?email=${encodeURIComponent(state.selectedDeveloper)}&appName=${encodeURIComponent(appName)}`, {
        method: 'DELETE'
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete app');
      }

      showToast(`App "${appName}" deleted successfully`, 'success');
      loadDeveloperApps(state.selectedDeveloper, true);
      loadDevelopers(true);
    } catch (err) {
      showToast('Error deleting app: ' + err.message, 'error');
    }
  }

  async function createAppKey(appName) {
    if (!state.selectedDeveloper) return;

    try {
      const resp = await fetch(`/api/developers/apps/keys?email=${encodeURIComponent(state.selectedDeveloper)}&appName=${encodeURIComponent(appName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiProducts: [] })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate key');
      }

      showToast('New credential key generated!', 'success');
      loadDeveloperApps(state.selectedDeveloper, true);
    } catch (err) {
      showToast('Error generating key: ' + err.message, 'error');
    }
  }

  async function deleteAppKey(appName, key) {
    if (!state.selectedDeveloper) return;
    if (!confirm(`Are you sure you want to revoke and delete API key "${key}"? Any clients using this key will immediately lose access.`)) {
      return;
    }

    try {
      const resp = await fetch(`/api/developers/apps/keys?email=${encodeURIComponent(state.selectedDeveloper)}&appName=${encodeURIComponent(appName)}&key=${encodeURIComponent(key)}`, {
        method: 'DELETE'
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete key');
      }

      showToast('Credential key deleted successfully', 'success');
      loadDeveloperApps(state.selectedDeveloper, true);
    } catch (err) {
      showToast('Error deleting key: ' + err.message, 'error');
    }
  }

  async function openManageSubscriptionsModal(appName, consumerKey) {
    state.selectedManagingApp = appName;
    state.selectedManagingKey = consumerKey;

    if (el.manageSubAppName) el.manageSubAppName.textContent = appName;
    if (el.manageSubKeySnippet) el.manageSubKeySnippet.textContent = consumerKey;

    const app = (state.selectedDeveloperApps || []).find(a => a.name === appName);
    const cred = app ? (app.credentials || []).find(c => c.consumerKey === consumerKey) : null;
    const currentSubs = new Set((cred ? cred.apiProducts || [] : []).map(p => p.apiproduct));

    if (!state.products || state.products.length === 0) {
      await loadProducts();
    }

    if (el.manageSubProductsList) {
      el.manageSubProductsList.innerHTML = (state.products || []).map(p => {
        const isChecked = currentSubs.has(p.name);
        const isAI = p.hasLlmConfig || p.name.toLowerCase().includes('ai');
        return `
          <div class="sub-product-item">
            <label>
              <input type="checkbox" name="manage-sub-product" value="${escapeHtml(p.name)}" ${isChecked ? 'checked' : ''}>
              <span style="font-weight: 500; font-size: 0.85rem;">${escapeHtml(p.displayName || p.name)}</span>
            </label>
            ${isAI ? '<span class="badge badge-purple" style="font-size: 0.7rem;">AI Model</span>' : ''}
          </div>
        `;
      }).join('');
    }

    if (el.modalManageSubscriptions && typeof el.modalManageSubscriptions.showModal === 'function') {
      el.modalManageSubscriptions.showModal();
    }
  }

  async function handleSaveSubscriptions(event) {
    event.preventDefault();
    if (!state.selectedDeveloper || !state.selectedManagingApp || !state.selectedManagingKey) return;

    const selectedProducts = [];
    if (el.manageSubProductsList) {
      el.manageSubProductsList.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        selectedProducts.push(cb.value);
      });
    }

    try {
      const url = `/api/developers/apps/keys/subscriptions?email=${encodeURIComponent(state.selectedDeveloper)}&appName=${encodeURIComponent(state.selectedManagingApp)}&key=${encodeURIComponent(state.selectedManagingKey)}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiProducts: selectedProducts })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update subscriptions');
      }

      if (el.modalManageSubscriptions) el.modalManageSubscriptions.close();
      showToast('Key product subscriptions updated successfully!', 'success');
      loadDeveloperApps(state.selectedDeveloper, true);
    } catch (err) {
      showToast('Error updating subscriptions: ' + err.message, 'error');
    }
  }

  // Event Listeners
  if (el.btnRefreshDevelopers) el.btnRefreshDevelopers.addEventListener('click', () => loadDevelopers(true));
  if (el.btnOpenCreateDeveloper) el.btnOpenCreateDeveloper.addEventListener('click', openCreateDeveloperModal);
  if (el.formCreateDeveloper) el.formCreateDeveloper.addEventListener('submit', handleCreateDeveloper);
  if (el.inputSearchDevs) el.inputSearchDevs.addEventListener('input', renderDevelopersTable);
  if (el.btnOpenCreateApp) el.btnOpenCreateApp.addEventListener('click', openCreateAppModal);
  if (el.btnEmptyCreateApp) el.btnEmptyCreateApp.addEventListener('click', openCreateAppModal);
  if (el.formCreateApp) el.formCreateApp.addEventListener('submit', handleCreateApp);
  if (el.formManageSubscriptions) el.formManageSubscriptions.addEventListener('submit', handleSaveSubscriptions);

  el.envSelector.addEventListener('change', () => {
    state.selectedEnv = el.envSelector.value;
    const activeTab = document.querySelector('.nav-tab.active')?.getAttribute('data-tab');
    if (activeTab === 'tab-analytics') loadAnalytics();
    else if (activeTab === 'tab-prices') loadPrices();
    else if (activeTab === 'tab-products') loadProducts();
    else if (activeTab === 'tab-developers') loadDevelopers();
  });

  el.timeRangeSelector.addEventListener('change', () => {
    state.timeRange = el.timeRangeSelector.value;
    const activeTab = document.querySelector('.nav-tab.active')?.getAttribute('data-tab');
    if (activeTab === 'tab-developers') {
      loadDevelopers();
    } else {
      loadAnalytics();
    }
  });

  el.btnRefreshAnalytics.addEventListener('click', () => loadAnalytics(true));
  el.btnRefreshProducts.addEventListener('click', () => loadProducts(true));

  el.dimButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      loadDimensionBreakdown(btn.getAttribute('data-dim'));
    });
  });

  el.analyticsSearch.addEventListener('input', renderBreakdownTable);
  el.priceSearch.addEventListener('input', renderPriceTable);

  window.addEventListener('resize', () => {
    if (document.getElementById('tab-analytics').classList.contains('active')) {
      renderCharts();
    }
  });

  // Utility to prevent XSS
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Initialization
  async function init() {
    initTheme();
    setupModals();
    setupNavigation();
    await loadConfig();
    // Run prices and analytics in parallel for faster startup
    await Promise.allSettled([
      loadPrices(),
      loadAnalytics()
    ]);
  }

  init();
})();
