from fastapi import APIRouter
from app.models.automaton import EquivalenceRequest, EquivalenceResponse
from app.algorithms.equivalence import check_automata_equivalence

router = APIRouter(prefix="/api/equivalence", tags=["Equivalence"])

@router.post("/verify", response_model=EquivalenceResponse)
def api_verify_equivalence(req: EquivalenceRequest):
    return check_automata_equivalence(req.automaton_a, req.automaton_b)

