/**
 * Portfolio Simulator - Charting Engine
 * Powered by Chart.js for high-performance canvas visualization
 */

export class PortfolioChartManager {
  constructor(canvasId, distCanvasId) {
    this.canvas = document.getElementById(canvasId);
    this.distCanvas = document.getElementById(distCanvasId);
    this.mainChart = null;
    this.distChart = null;
    this.lastData = null;
    this.displayMode = 'hybrid'; // 'hybrid' | 'quantiles' | 'all'
    this.scaleType = 'linear';   // 'linear' | 'logarithmic'
    this.currency = 'INR';       // 'INR' | 'USD'
  }

  setCurrency(currency) {
    this.currency = currency;
    if (this.lastData) {
      this.renderSimulationChart(this.lastData.data, this.lastData.initialInvestment);
    }
  }

  /**
   * Calculate step-by-step statistical metrics across all simulation paths
   */
  calculateStepStatistics(paths, initialInvestment) {
    if (!paths || paths.length === 0) return null;

    const numSims = paths.length;
    const numSteps = paths[0].length; // includes Day 0

    const meanPath = new Array(numSteps);
    const medianPath = new Array(numSteps);
    const p5Path = new Array(numSteps);
    const p25Path = new Array(numSteps);
    const p75Path = new Array(numSteps);
    const p95Path = new Array(numSteps);

    for (let step = 0; step < numSteps; step++) {
      const stepValues = new Float64Array(numSims);
      let sum = 0;

      for (let s = 0; s < numSims; s++) {
        const val = paths[s][step];
        stepValues[s] = val;
        sum += val;
      }

      stepValues.sort();

      meanPath[step] = sum / numSims;
      p5Path[step] = stepValues[Math.floor(numSims * 0.05)];
      p25Path[step] = stepValues[Math.floor(numSims * 0.25)];
      medianPath[step] = stepValues[Math.floor(numSims * 0.50)];
      p75Path[step] = stepValues[Math.floor(numSims * 0.75)];
      p95Path[step] = stepValues[Math.min(numSims - 1, Math.floor(numSims * 0.95))];
    }

    // Terminal statistics for distribution
    const terminalValues = paths.map(p => p[numSteps - 1]).sort((a, b) => a - b);
    const minFinal = terminalValues[0];
    const maxFinal = terminalValues[numSims - 1];

    return {
      numSims,
      numSteps,
      meanPath,
      medianPath,
      p5Path,
      p25Path,
      p75Path,
      p95Path,
      terminalValues,
      minFinal,
      maxFinal
    };
  }

  /**
   * Render the main simulation paths chart
   */
  renderSimulationChart(data, initialInvestment) {
    this.lastData = { data, initialInvestment };
    const { paths } = data;
    if (!paths || paths.length === 0) return;

    const stats = this.calculateStepStatistics(paths, initialInvestment);
    if (!stats) return;

    const { numSteps, meanPath, medianPath, p5Path, p25Path, p75Path, p95Path } = stats;

    const labels = Array.from({ length: numSteps }, (_, i) => i === 0 ? 'Day 0' : `Day ${i}`);

    // Build datasets based on display mode
    const datasets = [];

    // Baseline Reference: Initial Investment
    datasets.push({
      label: 'Initial Capital',
      data: Array(numSteps).fill(initialInvestment),
      borderColor: 'rgba(255, 255, 255, 0.4)',
      borderWidth: 1.5,
      borderDash: [5, 5],
      pointRadius: 0,
      fill: false,
      order: 1
    });

    // Quantile Envelope Bands (Confidence Interval Fill)
    if (this.displayMode === 'quantiles' || this.displayMode === 'hybrid') {
      // 95% Confidence Band (5% to 95%)
      datasets.push({
        label: '95th Percentile (Bull)',
        data: p95Path,
        borderColor: 'rgba(16, 185, 129, 0.9)',
        borderWidth: 2,
        pointRadius: 0,
        fill: '+1',
        backgroundColor: 'rgba(16, 185, 129, 0.05)',
        order: 2
      });

      datasets.push({
        label: '75th Percentile',
        data: p75Path,
        borderColor: 'rgba(59, 130, 246, 0.7)',
        borderWidth: 1.5,
        borderDash: [3, 3],
        pointRadius: 0,
        fill: '+1',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        order: 3
      });

      datasets.push({
        label: 'Median (50th)',
        data: medianPath,
        borderColor: '#00f2fe',
        borderWidth: 2.5,
        pointRadius: 0,
        fill: '+1',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        order: 4
      });

      datasets.push({
        label: '25th Percentile',
        data: p25Path,
        borderColor: 'rgba(245, 158, 11, 0.7)',
        borderWidth: 1.5,
        borderDash: [3, 3],
        pointRadius: 0,
        fill: '+1',
        backgroundColor: 'rgba(244, 63, 94, 0.05)',
        order: 5
      });

      datasets.push({
        label: '5th Percentile (VaR 95 Boundary)',
        data: p5Path,
        borderColor: '#f43f5e',
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        order: 6
      });

      // Expected Value / Mean Path
      datasets.push({
        label: 'Expected / Mean Path',
        data: meanPath,
        borderColor: '#fbbf24',
        borderWidth: 2.5,
        pointRadius: 0,
        fill: false,
        order: 1
      });
    }

    // Individual Trajectory Lines
    if (this.displayMode === 'all' || this.displayMode === 'hybrid') {
      const maxSamplePaths = this.displayMode === 'all' ? Math.min(paths.length, 120) : 40;
      const stepInterval = Math.max(1, Math.floor(paths.length / maxSamplePaths));

      for (let i = 0; i < paths.length && datasets.length < (maxSamplePaths + 10); i += stepInterval) {
        const path = paths[i];
        const isUp = path[numSteps - 1] >= initialInvestment;
        datasets.push({
          label: `Path #${i + 1}`,
          data: path,
          borderColor: isUp ? 'rgba(0, 242, 254, 0.18)' : 'rgba(244, 63, 94, 0.16)',
          borderWidth: 1,
          pointRadius: 0,
          fill: false,
          order: 10
        });
      }
    }

    if (this.mainChart) {
      this.mainChart.destroy();
    }

    const ctx = this.canvas.getContext('2d');
    const isINR = this.currency === 'INR';
    const symbol = isINR ? '₹' : '$';

    this.mainChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 650,
          easing: 'easeOutQuart'
        },
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 12,
              boxHeight: 3,
              color: '#94a3b8',
              font: {
                family: "'Inter', sans-serif",
                size: 11
              },
              filter: (item) => {
                return !item.text.startsWith('Path #');
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(14, 20, 32, 0.92)',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            borderColor: 'rgba(255, 255, 255, 0.15)',
            borderWidth: 1,
            padding: 12,
            boxPadding: 4,
            titleFont: { family: "'Inter', sans-serif", weight: 'bold' },
            bodyFont: { family: "'JetBrains Mono', monospace", size: 12 },
            callbacks: {
              label: (context) => {
                if (context.dataset.label.startsWith('Path #')) return null;
                const val = context.parsed.y;
                const formatted = new Intl.NumberFormat(isINR ? 'en-IN' : 'en-US', {
                  style: 'currency',
                  currency: isINR ? 'INR' : 'USD',
                  maximumFractionDigits: 0
                }).format(val);
                return ` ${context.dataset.label}: ${formatted}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.04)',
              drawBorder: false
            },
            ticks: {
              color: '#64748b',
              font: { family: "'JetBrains Mono', monospace", size: 11 },
              maxTicksLimit: 12
            }
          },
          y: {
            type: this.scaleType,
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
              drawBorder: false
            },
            ticks: {
              color: '#94a3b8',
              font: { family: "'JetBrains Mono', monospace", size: 11 },
              callback: (value) => {
                if (isINR) {
                  if (value >= 1e7) return `${symbol}${(value / 1e7).toFixed(1)}Cr`;
                  if (value >= 1e5) return `${symbol}${(value / 1e5).toFixed(1)}L`;
                  if (value >= 1e3) return `${symbol}${(value / 1e3).toFixed(0)}k`;
                  return `${symbol}${value}`;
                } else {
                  if (value >= 1e6) return `${symbol}${(value / 1e6).toFixed(1)}M`;
                  if (value >= 1e3) return `${symbol}${(value / 1e3).toFixed(0)}k`;
                  return `${symbol}${value}`;
                }
              }
            }
          }
        }
      }
    });

    // Also update terminal distribution histogram
    this.renderDistributionChart(stats, initialInvestment, data.risk_metrics);
  }

  /**
   * Render terminal value distribution histogram
   */
  renderDistributionChart(stats, initialInvestment, riskMetrics) {
    if (!this.distCanvas || !stats) return;

    const { terminalValues } = stats;
    const numBuckets = 24;
    const minVal = terminalValues[0];
    const maxVal = terminalValues[terminalValues.length - 1];
    const bucketWidth = (maxVal - minVal) / numBuckets;

    const bucketCounts = new Array(numBuckets).fill(0);
    const bucketLabels = new Array(numBuckets);
    const isINR = this.currency === 'INR';
    const symbol = isINR ? '₹' : '$';

    for (let i = 0; i < numBuckets; i++) {
      const lower = minVal + i * bucketWidth;
      if (isINR) {
        bucketLabels[i] = lower >= 1e5 ? `${symbol}${(lower / 1e5).toFixed(1)}L` : `${symbol}${Math.round(lower / 1000)}k`;
      } else {
        bucketLabels[i] = `${symbol}${Math.round(lower / 1000)}k`;
      }
    }

    for (const val of terminalValues) {
      let bucketIdx = Math.floor((val - minVal) / bucketWidth);
      if (bucketIdx >= numBuckets) bucketIdx = numBuckets - 1;
      bucketCounts[bucketIdx]++;
    }

    // Color bars: red if below initial investment, green/cyan if above
    const backgroundColors = [];
    const borderColors = [];

    for (let i = 0; i < numBuckets; i++) {
      const bucketMid = minVal + (i + 0.5) * bucketWidth;
      if (bucketMid < initialInvestment) {
        backgroundColors.push('rgba(244, 63, 94, 0.45)');
        borderColors.push('#f43f5e');
      } else {
        backgroundColors.push('rgba(0, 242, 254, 0.45)');
        borderColors.push('#00f2fe');
      }
    }

    if (this.distChart) {
      this.distChart.destroy();
    }

    const ctx = this.distCanvas.getContext('2d');
    this.distChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: bucketLabels,
        datasets: [{
          label: 'Outcomes Count',
          data: bucketCounts,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(14, 20, 32, 0.92)',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            borderColor: 'rgba(255, 255, 255, 0.15)',
            borderWidth: 1,
            callbacks: {
              title: (ctx) => `Range: ${ctx[0].label}`,
              label: (ctx) => ` ${ctx.parsed.y} simulations (${((ctx.parsed.y / stats.numSims) * 100).toFixed(1)}%)`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#64748b',
              font: { family: "'JetBrains Mono', monospace", size: 10 },
              maxTicksLimit: 8
            }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: {
              color: '#64748b',
              font: { family: "'JetBrains Mono', monospace", size: 10 }
            }
          }
        }
      }
    });
  }

  /**
   * Set display mode
   */
  setDisplayMode(mode) {
    this.displayMode = mode;
    if (this.lastData) {
      this.renderSimulationChart(this.lastData.data, this.lastData.initialInvestment);
    }
  }

  /**
   * Set scale type (linear or logarithmic)
   */
  setScaleType(type) {
    this.scaleType = type;
    if (this.lastData) {
      this.renderSimulationChart(this.lastData.data, this.lastData.initialInvestment);
    }
  }

  /**
   * Export simulation paths as CSV
   */
  exportCsv() {
    if (!this.lastData || !this.lastData.data || !this.lastData.data.paths) {
      alert('No simulation data available to export.');
      return;
    }

    const { paths } = this.lastData.data;
    const numSteps = paths[0].length;

    let csvContent = 'data:text/csv;charset=utf-8,';
    // Header row
    const headers = ['Simulation_ID', ...Array.from({ length: numSteps }, (_, i) => `Day_${i}`)];
    csvContent += headers.join(',') + '\r\n';

    // Data rows
    paths.forEach((path, idx) => {
      const row = [idx + 1, ...path.map(v => v.toFixed(2))];
      csvContent += row.join(',') + '\r\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `portfolio_simulation_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Export chart as image
   */
  exportImage() {
    if (!this.mainChart) {
      alert('No chart available to export.');
      return;
    }

    const imageUri = this.mainChart.toBase64Image();
    const link = document.createElement('a');
    link.setAttribute('href', imageUri);
    link.setAttribute('download', `portfolio_paths_chart_${Date.now()}.png`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
