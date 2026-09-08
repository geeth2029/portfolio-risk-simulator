"""FastAPI service for Monte Carlo portfolio simulations."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import os
import uvicorn

from monte_carlo import calculate_risk_metrics, simulate_paths


app = FastAPI(title="Portfolio Monte Carlo Simulator")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SimulationRequest(BaseModel):
    tickers: list[str] = Field(min_length=1)
    initial_investment: float = Field(gt=0)
    time_horizon: int = Field(gt=0)
    num_simulations: int = Field(gt=0)


@app.get("/health")
@app.get("/api/health")
def health_check():
    return {"status": "online", "message": "FastAPI Monte Carlo Engine Connected"}


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


# Mount css and js directories directly if they exist in root
if os.path.exists("css"):
    app.mount("/css", StaticFiles(directory="css"), name="css")

if os.path.exists("js"):
    app.mount("/js", StaticFiles(directory="js"), name="js")

# Mount general static assets if static folder exists
if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")

# Serve index.html at root route
@app.get("/")
def read_root():
    return FileResponse("index.html")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
