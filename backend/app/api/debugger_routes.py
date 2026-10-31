from fastapi import APIRouter
from app.models.automaton import AutomatonModel, DebugReport
from app.optimization.debugger import debug_automaton

router = APIRouter(prefix="/api/debugger", tags=["Debugger"])

@router.post("/analyze", response_model=DebugReport)
def api_debug_automaton(aut: AutomatonModel):
    return debug_automaton(aut)
