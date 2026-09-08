"""FastAPI service for Monte Carlo portfolio simulations."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

from monte_carlo import calculate_risk_metrics, simulate_paths


app = FastAPI(title="Portfolio Monte Carlo Simulator")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SimulationRequest(BaseModel):
    tickers: list[str] = Field(min_length=1)
    initial_investment: float = Field(gt=0)
    time_horizon: int = Field(gt=0)
    num_simulations: int = Field(gt=0)


@app.post("/api/simulate")
def simulate(request: SimulationRequest) -> dict:
    """Run a portfolio simulation and return paths plus risk metrics."""
    try:
        paths = simulate_paths(
            request.tickers,
            initial_value=request.initial_investment,
            simulations=request.num_simulations,
            horizon=request.time_horizon,
        )
        metrics = calculate_risk_metrics(paths, request.initial_investment)
    except (ValueError, KeyError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return {
        "paths": paths.tolist(),
        "risk_metrics": metrics,
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
