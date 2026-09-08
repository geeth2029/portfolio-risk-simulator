/**
 * Portfolio Simulator - Application Controller
 * Handles user interactions, form submissions, state management, and animated updates
 */

import { PortfolioApiClient } from './api.js';
import { PortfolioChartManager } from './charts.js';

const API_BASE_URL = window.location.origin.includes('localhost')
  ? 'http://localhost:8000'
  : window.location.origin;

// Application State
const state = {
  tickers: ['TCS.NS', 'INFY.NS', 'WIPRO.NS', 'HCLTECH.NS'],
  initialInvestment: 500000,
  timeHorizon: 252,
  numSimulations: 500,
  backendUrl: API_BASE_URL,
  isLoading: false,
  lastResult: null,
  currency: 'INR'
};

// Preset configurations
const PRESETS = {
  nifty_it: {
    label: 'Nifty IT',
    tickers: ['TCS.NS', 'INFY.NS', 'WIPRO.NS', 'HCLTECH.NS'],
    initialInvestment: 500000,
    timeHorizon: 252,
    numSimulations: 500,
    currency: 'INR'
  },
  india_bluechips: {
    label: 'India Bluechips',
    tickers: ['RELIANCE.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'TCS.NS'],
    initialInvestment: 1000000,
    timeHorizon: 252,
    numSimulations: 500,
    currency: 'INR'
  },
  tech: {
    label: 'Tech Titans',
    tickers: ['AAPL', 'MSFT', 'GOOGL', 'NVDA'],
    initialInvestment: 100000,
    timeHorizon: 252,
    numSimulations: 500,
    currency: 'USD'
  },
  balanced: {
    label: 'Balanced 60/40',
    tickers: ['SPY', 'BND'],
    initialInvestment: 100000,
    timeHorizon: 252,
    numSimulations: 500,
    currency: 'USD'
  },
  allweather: {
    label: 'All-Weather',
    tickers: ['SPY', 'TLT', 'GLD', 'IEF'],
    initialInvestment: 100000,
    timeHorizon: 252,
    numSimulations: 500,
    currency: 'USD'
  },
  growth: {
    label: 'High Growth',
    tickers: ['TSLA', 'NVDA', 'AMD', 'META'],
    initialInvestment: 50000,
    timeHorizon: 180,
    numSimulations: 500,
    currency: 'USD'
  }
};

// Quick investment amount configurations for INR & USD
const QUICK_INVESTMENTS = {
  INR: [
    { amount: 50000, label: '₹50k' },
    { amount: 100000, label: '₹1L' },
    { amount: 500000, label: '₹5L' },
    { amount: 1000000, label: '₹10L' },
    { amount: 2500000, label: '₹25L' },
    { amount: 5000000, label: '₹50L' }
  ],
  USD: [
    { amount: 10000, label: '$10k' },
    { amount: 50000, label: '$50k' },
    { amount: 100000, label: '$100k' },
    { amount: 500000, label: '$500k' },
    { amount: 1000000, label: '$1M' }
  ]
};

// Initialize instances
const apiClient = new PortfolioApiClient(state.backendUrl);
const chartManager = new PortfolioChartManager('simulationChart', 'distributionChart');

// DOM Elements
const elements = {
  form: document.getElementById('simulationForm'),
  tickersInput: document.getElementById('tickersInput'),
  tickerChipsContainer: document.getElementById('tickerChips'),
  initialInvestmentInput: document.getElementById('initialInvestment'),
  timeHorizonInput: document.getElementById('timeHorizon'),
  numSimulationsInput: document.getElementById('numSimulations'),
  simulationsSlider: document.getElementById('simulationsSlider'),
  backendUrlInput: document.getElementById('backendUrlInput'),
  submitBtn: document.getElementById('submitBtn'),
  statusBadge: document.getElementById('backendStatus'),
  statusText: document.getElementById('backendStatusText'),
  alertBanner: document.getElementById('alertBanner'),
  alertText: document.getElementById('alertText'),
  chartLoader: document.getElementById('chartLoader'),

  // Metric elements
  expectedValue: document.getElementById('metricExpectedValue'),
  expectedReturn: document.getElementById('metricExpectedReturn'),
  varValue: document.getElementById('metricVarValue'),
  varPercent: document.getElementById('metricVarPercent'),
  cvarValue: document.getElementById('metricCvarValue'),
  cvarPercent: document.getElementById('metricCvarPercent'),
  probLossValue: document.getElementById('metricProbLossValue'),
  probLossBadge: document.getElementById('metricProbLossBadge'),

  // Detailed stats table elements
  statMin: document.getElementById('statMin'),
  statP5: document.getElementById('statP5'),
  statMedian: document.getElementById('statMedian'),
  statMean: document.getElementById('statMean'),
  statP95: document.getElementById('statP95'),
  statMax: document.getElementById('statMax'),
  statReturn: document.getElementById('statReturn'),
  statHorizon: document.getElementById('statHorizon')
};

// Safe DOM text setter helper
function safeSetText(elemOrId, text) {
  const el = typeof elemOrId === 'string' ? document.getElementById(elemOrId) : elemOrId;
  if (el) {
    el.textContent = text;
    return true;
  }
  return false;
}

// Set active currency (INR / USD)
function setCurrency(currency, updateQuickPicks = true) {
  state.currency = currency;
  const isINR = currency === 'INR';
  const symbol = isINR ? '₹' : '$';

  // Update label, icon and helper text
  safeSetText('currencySymbolLabel', symbol);
  safeSetText('currencyInputIcon', symbol);
  safeSetText('currencyHint', isINR ? '₹ / INR Capital' : '$ / USD Capital');

  // Update currency toggle buttons active class
  document.querySelectorAll('[data-currency]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.currency === currency);
  });

  // Update quick pick buttons
  if (updateQuickPicks) {
    const picksContainer = document.getElementById('quickInvestmentPicks');
    if (picksContainer) {
      picksContainer.innerHTML = '';
      const currentVal = elements.initialInvestmentInput ? parseFloat(elements.initialInvestmentInput.value) : 0;
      const options = QUICK_INVESTMENTS[currency] || QUICK_INVESTMENTS.INR;
      options.forEach(opt => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `btn-quick ${currentVal === opt.amount ? 'active' : ''}`;
        btn.dataset.amount = opt.amount;
        btn.textContent = opt.label;
        btn.addEventListener('click', () => {
          if (elements.initialInvestmentInput) {
            elements.initialInvestmentInput.value = opt.amount;
            document.querySelectorAll('#quickInvestmentPicks .btn-quick').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
          }
        });
        picksContainer.appendChild(btn);
      });
    }
  }

  // Update chart currency
  chartManager.setCurrency(currency);

  // Refresh metric cards if simulation results already exist
  if (state.lastResult) {
    const initVal = elements.initialInvestmentInput ? parseFloat(elements.initialInvestmentInput.value) : state.initialInvestment;
    displayMetrics(state.lastResult.risk_metrics, initVal, state.lastResult.paths);
  }
}

// Helpers for currency formatting
const formatCurrency = (val) => {
  const isINR = state.currency === 'INR';
  return new Intl.NumberFormat(isINR ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency: isINR ? 'INR' : 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val);
};

const formatPercent = (val) => {
  const pct = val * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
};

// Animate numbers smoothly
function animateNumber(element, start, end, duration = 800, formatter = formatCurrency) {
  const el = typeof element === 'string' ? document.getElementById(element) : element;
  if (!el) return;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // ease-out cubic
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = start + (end - start) * ease;
    if (el) {
      el.textContent = formatter(current);
    }

    if (progress < 1) {
      requestAnimationFrame(update);
    } else if (el) {
      el.textContent = formatter(end);
    }
  }

  requestAnimationFrame(update);
}

// Parse and update ticker chips
function updateTickerChips() {
  if (!elements.tickersInput || !elements.tickerChipsContainer) return;
  const raw = elements.tickersInput.value || '';
  state.tickers = raw
    .split(',')
    .map(t => t.trim().toUpperCase())
    .filter(t => t.length > 0);

  elements.tickerChipsContainer.innerHTML = '';
  state.tickers.forEach((symbol, index) => {
    const chip = document.createElement('span');
    chip.className = 'ticker-chip';
    chip.innerHTML = `${symbol} <span class="remove-ticker" data-index="${index}">&times;</span>`;
    elements.tickerChipsContainer.appendChild(chip);
  });

  // Auto-detect currency if user enters Indian tickers (.NS or .BO)
  const hasIndianTicker = state.tickers.some(t => t.endsWith('.NS') || t.endsWith('.BO'));
  if (hasIndianTicker && state.currency !== 'INR') {
    setCurrency('INR', false);
  }
}

// Show alert banner
function showAlert(message, type = 'error') {
  if (elements.alertBanner) {
    elements.alertBanner.className = `alert-banner ${type}`;
    elements.alertBanner.style.display = 'flex';
  }
  safeSetText(elements.alertText || 'alertText', message);
}

function hideAlert() {
  if (elements.alertBanner) {
    elements.alertBanner.style.display = 'none';
  }
}

// Backend Health Checking
async function checkBackendStatus() {
  const isHealthy = await apiClient.checkHealth();
  const badge = elements.statusBadge || document.getElementById('backendStatus');
  const text = elements.statusText || document.getElementById('backendStatusText');

  if (badge) {
    if (isHealthy) {
      badge.className = 'status-badge connected';
      badge.title = 'Backend is responding normally';
      safeSetText(text, 'Connected (FastAPI :8000)');
    } else {
      badge.className = 'status-badge error';
      badge.title = `Cannot reach FastAPI backend at ${apiClient.baseUrl}`;
      safeSetText(text, 'Backend Disconnected');
    }
  }
}

// Update UI with simulation metrics safely checking all DOM selectors
function displayMetrics(metrics, initialInvestment, paths) {
  if (!metrics) return;

  const expectedFinalVal = metrics['Expected Final Value'] ?? 0;
  const var95 = metrics['95% VaR'] ?? 0;
  const cvar95 = metrics['95% CVaR'] ?? 0;
  const probLoss = metrics['Probability of Loss'] ?? 0;

  // Expected Value Card
  animateNumber(elements.expectedValue || 'metricExpectedValue', 0, expectedFinalVal, 800, formatCurrency);
  const totalReturn = (expectedFinalVal - initialInvestment) / initialInvestment;
  const expectedReturnEl = elements.expectedReturn || document.getElementById('metricExpectedReturn');
  if (expectedReturnEl) {
    expectedReturnEl.textContent = formatPercent(totalReturn);
    expectedReturnEl.className = `metric-badge ${totalReturn >= 0 ? 'positive' : 'negative'}`;
  }

  // 95% VaR Card
  animateNumber(elements.varValue || 'metricVarValue', 0, var95, 800, formatCurrency);
  const varPct = (var95 / initialInvestment) * 100;
  const varPercentEl = elements.varPercent || document.getElementById('metricVarPercent');
  if (varPercentEl) {
    varPercentEl.textContent = `${varPct.toFixed(1)}% of capital`;
  }

  // 95% CVaR Card
  animateNumber(elements.cvarValue || 'metricCvarValue', 0, cvar95, 800, formatCurrency);
  const cvarPct = (cvar95 / initialInvestment) * 100;
  const cvarPercentEl = elements.cvarPercent || document.getElementById('metricCvarPercent');
  if (cvarPercentEl) {
    cvarPercentEl.textContent = `${cvarPct.toFixed(1)}% of capital`;
  }

  // Probability of Loss Card
  animateNumber(elements.probLossValue || 'metricProbLossValue', 0, probLoss, 800, (v) => `${(v * 100).toFixed(1)}%`);
  const probLossBadgeEl = elements.probLossBadge || document.getElementById('metricProbLossBadge');
  if (probLossBadgeEl) {
    probLossBadgeEl.textContent = probLoss > 0.4 ? 'High Risk' : probLoss > 0.2 ? 'Moderate' : 'Low Risk';
    probLossBadgeEl.className = `metric-badge ${probLoss > 0.4 ? 'negative' : probLoss > 0.2 ? 'warning' : 'positive'}`;
  }

  // Detailed Table Updates
  if (paths && paths.length > 0) {
    const numSteps = paths[0].length;
    const terminalValues = paths.map(p => p[numSteps - 1]).sort((a, b) => a - b);
    const n = terminalValues.length;

    safeSetText(elements.statMin || 'statMin', formatCurrency(terminalValues[0]));
    safeSetText(elements.statP5 || 'statP5', formatCurrency(terminalValues[Math.floor(n * 0.05)]));
    safeSetText(elements.statMedian || 'statMedian', formatCurrency(terminalValues[Math.floor(n * 0.50)]));
    safeSetText(elements.statMean || 'statMean', formatCurrency(expectedFinalVal));
    safeSetText(elements.statP95 || 'statP95', formatCurrency(terminalValues[Math.min(n - 1, Math.floor(n * 0.95))]));
    safeSetText(elements.statMax || 'statMax', formatCurrency(terminalValues[n - 1]));
    safeSetText(elements.statReturn || 'statReturn', formatPercent(totalReturn));
    safeSetText(elements.statHorizon || 'statHorizon', `${numSteps - 1} Trading Days`);
  }
}

// Execute Simulation
async function runSimulation() {
  if (state.isLoading) return;

  hideAlert();
  state.isLoading = true;
  if (elements.submitBtn) {
    elements.submitBtn.disabled = true;
    elements.submitBtn.classList.add('loading');
  }
  if (elements.chartLoader) {
    elements.chartLoader.classList.add('active');
  }

  const tickersRaw = elements.tickersInput ? elements.tickersInput.value : 'AAPL, MSFT, GOOGL';
  const initialInvestment = elements.initialInvestmentInput ? parseFloat(elements.initialInvestmentInput.value) : 100000;
  const timeHorizon = elements.timeHorizonInput ? parseInt(elements.timeHorizonInput.value, 10) : 252;
  const numSimulations = elements.numSimulationsInput ? parseInt(elements.numSimulationsInput.value, 10) : 500;

  const parsedTickers = tickersRaw
    .split(',')
    .map(t => t.trim().toUpperCase())
    .filter(Boolean);

  if (parsedTickers.length === 0) {
    showAlert('Please enter at least one valid ticker symbol.');
    state.isLoading = false;
    if (elements.submitBtn) {
      elements.submitBtn.disabled = false;
      elements.submitBtn.classList.remove('loading');
    }
    if (elements.chartLoader) {
      elements.chartLoader.classList.remove('active');
    }
    return;
  }

  try {
    let result;
    try {
      result = await apiClient.simulate({
        tickers: parsedTickers,
        initialInvestment,
        timeHorizon,
        numSimulations
      });
      // Mark backend status as connected
      if (elements.statusBadge) elements.statusBadge.className = 'status-badge connected';
      safeSetText(elements.statusText || 'backendStatusText', 'Connected (FastAPI :8000)');
    } catch (apiError) {
      console.warn('API call failed, attempting fallback or reporting error:', apiError);
      // If server unreachable, provide clear notice and generate realistic simulation fallback
      if (apiError.message && apiError.message.includes('Unable to connect to FastAPI backend')) {
        showAlert(
          'FastAPI backend unreachable on port 8000. Generated fallback Geometric Brownian Motion simulation for demo visualization.',
          'warning'
        );
        if (elements.statusBadge) elements.statusBadge.className = 'status-badge error';
        safeSetText(elements.statusText || 'backendStatusText', 'Backend Offline (Demo Mode)');
        result = apiClient.generateFallbackSimulation({
          tickers: parsedTickers,
          initialInvestment,
          timeHorizon,
          numSimulations
        });
      } else {
        throw apiError;
      }
    }

    state.lastResult = result;

    // Render Metrics safely
    displayMetrics(result.risk_metrics, initialInvestment, result.paths);

    // Render Main Charts
    chartManager.renderSimulationChart(result, initialInvestment);

  } catch (err) {
    console.error('Simulation error:', err);
    showAlert(err.message || 'An unexpected error occurred during simulation.');
  } finally {
    state.isLoading = false;
    if (elements.submitBtn) {
      elements.submitBtn.disabled = false;
      elements.submitBtn.classList.remove('loading');
    }
    if (elements.chartLoader) {
      elements.chartLoader.classList.remove('active');
    }
  }
}

// Load Preset
function applyPreset(presetKey) {
  const preset = PRESETS[presetKey];
  if (!preset) return;

  if (preset.currency && preset.currency !== state.currency) {
    setCurrency(preset.currency, true);
  }

  if (elements.tickersInput) elements.tickersInput.value = preset.tickers.join(', ');
  if (elements.initialInvestmentInput) elements.initialInvestmentInput.value = preset.initialInvestment;
  if (elements.timeHorizonInput) elements.timeHorizonInput.value = preset.timeHorizon;
  if (elements.numSimulationsInput) elements.numSimulationsInput.value = preset.numSimulations;
  if (elements.simulationsSlider) elements.simulationsSlider.value = preset.numSimulations;

  // Active chip styling
  document.querySelectorAll('.preset-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === presetKey);
  });

  updateTickerChips();
  runSimulation();
}

// Event Listeners Setup
function setupEventListeners() {
  // Form Submit
  if (elements.form) {
    elements.form.addEventListener('submit', (e) => {
      e.preventDefault();
      runSimulation();
    });
  }

  // Currency Switcher Buttons
  document.querySelectorAll('[data-currency]').forEach(btn => {
    btn.addEventListener('click', () => {
      setCurrency(btn.dataset.currency, true);
    });
  });

  // Tickers Input changes
  if (elements.tickersInput) {
    elements.tickersInput.addEventListener('input', () => {
      updateTickerChips();
    });
  }

  // Remove ticker via chip
  if (elements.tickerChipsContainer) {
    elements.tickerChipsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-ticker')) {
        const idx = parseInt(e.target.dataset.index, 10);
        const currentTickers = (elements.tickersInput ? elements.tickersInput.value : '')
          .split(',')
          .map(t => t.trim())
          .filter(Boolean);
        currentTickers.splice(idx, 1);
        if (elements.tickersInput) {
          elements.tickersInput.value = currentTickers.join(', ');
        }
        updateTickerChips();
      }
    });
  }

  // Slider & Number Input Sync
  if (elements.simulationsSlider && elements.numSimulationsInput) {
    elements.simulationsSlider.addEventListener('input', (e) => {
      elements.numSimulationsInput.value = e.target.value;
    });

    elements.numSimulationsInput.addEventListener('input', (e) => {
      elements.simulationsSlider.value = e.target.value;
    });
  }

  // Quick Investment Buttons
  document.querySelectorAll('.btn-quick[data-amount]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (elements.initialInvestmentInput) {
        elements.initialInvestmentInput.value = btn.dataset.amount;
      }
    });
  });

  // Quick Horizon Buttons
  document.querySelectorAll('.btn-quick[data-days]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (elements.timeHorizonInput) {
        elements.timeHorizonInput.value = btn.dataset.days;
      }
    });
  });

  // Preset Chips
  document.querySelectorAll('.preset-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      applyPreset(btn.dataset.preset);
    });
  });

  // Chart Display Mode Buttons
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      chartManager.setDisplayMode(btn.dataset.mode);
    });
  });

  // Chart Scale Buttons
  document.querySelectorAll('[data-scale]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-scale]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      chartManager.setScaleType(btn.dataset.scale);
    });
  });

  // Chart Export Buttons
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => chartManager.exportCsv());
  }

  const exportImgBtn = document.getElementById('exportImgBtn');
  if (exportImgBtn) {
    exportImgBtn.addEventListener('click', () => chartManager.exportImage());
  }

  // Backend URL customization
  if (elements.backendUrlInput) {
    elements.backendUrlInput.addEventListener('change', (e) => {
      apiClient.setBaseUrl(e.target.value);
      checkBackendStatus();
    });
  }
}

// App Initialization
async function init() {
  updateTickerChips();
  setupEventListeners();

  // Check health and run initial simulation
  await checkBackendStatus();
  setInterval(checkBackendStatus, 15000);

  // Trigger initial simulation
  runSimulation();
}

// Launch on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
