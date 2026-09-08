"""Monte Carlo simulation for a multi-asset investment portfolio."""

from __future__ import annotations

from typing import Sequence

import numpy as np
import pandas as pd
import yfinance as yf


def fetch_price_data(
    tickers: Sequence[str],
    period: str = "5y",
) -> pd.DataFrame:
    """Fetch adjusted daily closing prices for the requested tickers."""
    symbols = [ticker.strip().upper() for ticker in tickers if ticker.strip()]
    if not symbols:
        raise ValueError("At least one ticker is required.")

    prices = yf.download(
        symbols,
        period=period,
        auto_adjust=True,
        progress=False,
    )
    if prices.empty:
        raise ValueError("No price data was returned for the requested tickers.")

    if isinstance(prices.columns, pd.MultiIndex):
        level = "Close" if "Close" in prices.columns.get_level_values(0) else "Adj Close"
        prices = prices[level]
    elif "Close" in prices.columns:
        prices = prices[["Close"]].rename(columns={"Close": symbols[0]})

    prices = prices.reindex(columns=symbols).dropna(how="all").ffill().dropna()
    missing = [symbol for symbol in symbols if symbol not in prices.columns]
    if missing or prices.empty:
        raise ValueError(f"Missing usable price data for: {', '.join(missing or symbols)}")
    return prices


def calculate_statistics(prices: pd.DataFrame) -> tuple[pd.Series, pd.DataFrame]:
    """Calculate mean daily returns and the daily return covariance matrix."""
    returns = prices.pct_change().dropna()
    if returns.empty:
        raise ValueError("At least two price observations are required.")
    return returns.mean(), returns.cov()


def simulate_portfolio(
    tickers: Sequence[str],
    initial_value: float = 100_000.0,
    simulations: int = 1_000,
    horizon: int = 252,
    period: str = "5y",
    weights: Sequence[float] | None = None,
    seed: int | None = None,
) -> dict[str, float]:
    """Run Monte Carlo paths and return portfolio risk metrics."""
    paths = simulate_paths(
        tickers,
        initial_value=initial_value,
        simulations=simulations,
        horizon=horizon,
        period=period,
        weights=weights,
        seed=seed,
    )
    return calculate_risk_metrics(paths, initial_value)


def simulate_paths(
    tickers: Sequence[str],
    initial_value: float = 100_000.0,
    simulations: int = 1_000,
    horizon: int = 252,
    period: str = "5y",
    weights: Sequence[float] | None = None,
    seed: int | None = None,
) -> np.ndarray:
    """Return portfolio values for each simulated day, including day zero."""
    if initial_value <= 0 or simulations <= 0 or horizon <= 0:
        raise ValueError("initial_value, simulations, and horizon must be positive.")

    prices = fetch_price_data(tickers, period=period)
    mean_returns, covariance = calculate_statistics(prices)
    asset_count = len(mean_returns)

    if weights is None:
        portfolio_weights = np.full(asset_count, 1.0 / asset_count)
    else:
        portfolio_weights = np.asarray(weights, dtype=float)
        if len(portfolio_weights) != asset_count:
            raise ValueError("weights must contain one value per ticker.")
        if np.any(portfolio_weights < 0) or not np.isclose(portfolio_weights.sum(), 1.0):
            raise ValueError("weights must be non-negative and sum to 1.")

    rng = np.random.default_rng(seed)
    covariance_matrix = covariance.to_numpy()
    jitter = np.eye(asset_count) * 1e-12
    chol = np.linalg.cholesky(covariance_matrix + jitter)
    daily_drift = mean_returns.to_numpy() - 0.5 * np.diag(covariance_matrix)

    shocks = rng.standard_normal((simulations, horizon, asset_count))
    correlated_shocks = shocks @ chol.T
    log_returns = daily_drift + correlated_shocks
    asset_growth = np.exp(np.cumsum(log_returns, axis=1))
    asset_values = initial_value * asset_growth * portfolio_weights
    paths = asset_values.sum(axis=2)
    return np.concatenate(
        [np.full((simulations, 1), initial_value), paths],
        axis=1,
    )


def calculate_risk_metrics(
    paths: np.ndarray,
    initial_value: float,
) -> dict[str, float]:
    """Calculate terminal-value risk metrics from simulated portfolio paths."""
    final_values = paths[:, -1]

    losses = initial_value - final_values
    var_threshold = np.percentile(losses, 95)
    tail_losses = losses[losses >= var_threshold]
    return {
        "Expected Final Value": float(final_values.mean()),
        "95% VaR": float(var_threshold),
        "95% CVaR": float(tail_losses.mean()),
        "Probability of Loss": float(np.mean(final_values < initial_value)),
    }


if __name__ == "__main__":
    metrics = simulate_portfolio(["AAPL", "MSFT", "GOOGL"], seed=42)
    for name, value in metrics.items():
        if name == "Probability of Loss":
            print(f"{name}: {value:.2%}")
        else:
            print(f"{name}: ${value:,.2f}")