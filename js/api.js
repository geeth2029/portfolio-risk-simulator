/**
 * Portfolio Simulator - API Client
 * Connects to FastAPI backend at http://localhost:8000/api/simulate
 */

export class PortfolioApiClient {
  constructor(baseUrl = 'http://localhost:8000') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  setBaseUrl(url) {
    this.baseUrl = url.replace(/\/$/, '');
  }

  /**
   * Health check / ping to backend
   */
  async checkHealth() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(`${this.baseUrl}/docs`, {
        method: 'GET',
        signal: controller.signal,
        mode: 'cors'
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      // Some servers may not have /docs, try root or return false
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${this.baseUrl}/openapi.json`, {
          method: 'GET',
          signal: controller.signal,
          mode: 'cors'
        });
        clearTimeout(timeoutId);
        return res.ok;
      } catch (e) {
        return false;
      }
    }
  }

  /**
   * Run simulation via FastAPI endpoint POST /api/simulate
   * @param {Object} params
   * @param {string[]} params.tickers
   * @param {number} params.initialInvestment
   * @param {number} params.timeHorizon
   * @param {number} params.numSimulations
   */
  async simulate({ tickers, initialInvestment, timeHorizon, numSimulations }) {
    const payload = {
      tickers: tickers.map(t => t.trim().toUpperCase()).filter(Boolean),
      initial_investment: parseFloat(initialInvestment),
      time_horizon: parseInt(timeHorizon, 10),
      num_simulations: parseInt(numSimulations, 10)
    };

    if (payload.tickers.length === 0) {
      throw new Error('At least one ticker symbol is required.');
    }
    if (isNaN(payload.initial_investment) || payload.initial_investment <= 0) {
      throw new Error('Initial investment must be greater than 0.');
    }
    if (isNaN(payload.time_horizon) || payload.time_horizon <= 0) {
      throw new Error('Time horizon must be at least 1 trading day.');
    }
    if (isNaN(payload.num_simulations) || payload.num_simulations <= 0) {
      throw new Error('Number of simulations must be at least 1.');
    }

    const endpoint = `${this.baseUrl}/api/simulate`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorDetail = `Server returned status ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.detail) {
            errorDetail = errData.detail;
          }
        } catch (_) {
          const text = await response.text();
          if (text) errorDetail = text;
        }
        throw new Error(errorDetail);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        throw new Error(
          `Unable to connect to FastAPI backend at ${endpoint}. Please ensure the backend is running on port 8000 and accessible.`
        );
      }
      throw err;
    }
  }

  /**
   * Client-side fallback simulation generator (GBM) for demo/testing purposes
   */
  generateFallbackSimulation({ tickers, initialInvestment, timeHorizon, numSimulations }) {
    const horizon = parseInt(timeHorizon, 10);
    const sims = parseInt(numSimulations, 10);
    const initVal = parseFloat(initialInvestment);

    // Realistic annual return ~10%, volatility ~18%
    const dt = 1 / 252;
    const mu = 0.10;
    const sigma = 0.18;
    const drift = (mu - 0.5 * sigma * sigma) * dt;
    const vol = sigma * Math.sqrt(dt);

    const paths = [];
    const finalValues = [];

    for (let s = 0; s < sims; s++) {
      const path = [initVal];
      let current = initVal;

      for (let t = 1; t <= horizon; t++) {
        // Box-Muller transform for standard normal random variable
        const u1 = Math.max(1e-10, Math.random());
        const u2 = Math.random();
        const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

        current = current * Math.exp(drift + vol * z);
        path.push(current);
      }
      paths.push(path);
      finalValues.push(current);
    }

    // Sort final values for percentile calculations
    finalValues.sort((a, b) => a - b);
    const expectedFinalValue = finalValues.reduce((a, b) => a + b, 0) / sims;

    const losses = finalValues.map(v => initVal - v);
    losses.sort((a, b) => a - b); // Ascending order of loss

    const varIndex = Math.floor(0.95 * sims);
    const var95 = losses[Math.min(varIndex, sims - 1)];

    const tailLosses = losses.slice(varIndex);
    const cvar95 = tailLosses.length > 0 ? tailLosses.reduce((a, b) => a + b, 0) / tailLosses.length : var95;

    const lossCount = finalValues.filter(v => v < initVal).length;
    const probLoss = lossCount / sims;

    return {
      paths,
      risk_metrics: {
        'Expected Final Value': expectedFinalValue,
        '95% VaR': var95,
        '95% CVaR': cvar95,
        'Probability of Loss': probLoss
      },
      isFallback: true
    };
  }
}
