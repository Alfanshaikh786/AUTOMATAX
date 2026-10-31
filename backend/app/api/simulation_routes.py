from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from app.models.automaton import AutomatonModel, SimulationResult, BatchSimulationResponse
from app.simulation.simulator import simulate_string, batch_simulate

router = APIRouter(prefix="/api/simulation", tags=["Simulation"])

class SingleSimulationRequest(BaseModel):
    automaton: AutomatonModel
    input_string: str

class BatchSimulationRequest(BaseModel):
    automaton: AutomatonModel
    test_strings: List[str]

@router.post("/simulate", response_model=SimulationResult)
def api_simulate_string(req: SingleSimulationRequest):
    return simulate_string(req.automaton, req.input_string)

@router.post("/batch", response_model=BatchSimulationResponse)
def api_batch_simulate(req: BatchSimulationRequest):
    return batch_simulate(req.automaton, req.test_strings)
