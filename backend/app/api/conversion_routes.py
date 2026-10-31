from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from app.models.automaton import AutomatonModel, ConversionResponse
from app.core.automaton_types import AutomatonType, ConversionAlgorithm
from app.algorithms.epsilon_elimination import convert_enfa_to_nfa
from app.algorithms.subset_construction import convert_to_dfa_subset_construction
from app.algorithms.minimization import minimize_dfa_hopcroft
from app.algorithms.state_elimination import convert_automaton_to_regex

router = APIRouter(prefix="/api/conversions", tags=["Conversions"])

@router.post("/enfa-to-nfa", response_model=ConversionResponse)
def api_enfa_to_nfa(aut: AutomatonModel):
    try:
        return convert_enfa_to_nfa(aut)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/to-dfa", response_model=ConversionResponse)
def api_to_dfa(aut: AutomatonModel):
    try:
        return convert_to_dfa_subset_construction(aut)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/minimize-dfa", response_model=ConversionResponse)
def api_minimize_dfa(aut: AutomatonModel):
    try:
        if aut.type != AutomatonType.DFA:
            # If NFA or ENFA, convert to DFA first
            dfa_res = convert_to_dfa_subset_construction(aut)
            return minimize_dfa_hopcroft(dfa_res.converted_automaton)
        return minimize_dfa_hopcroft(aut)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/to-regex")
def api_to_regex(aut: AutomatonModel):
    try:
        return convert_automaton_to_regex(aut)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
