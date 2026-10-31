from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
from app.models.regular_expression import RegexParseResult, RegexConversionResult
from app.algorithms.regex_parser import RegexParser
from app.algorithms.thompson_glushkov import convert_regex_to_thompson, convert_regex_to_glushkov
from app.algorithms.subset_construction import convert_to_dfa_subset_construction
from app.algorithms.minimization import minimize_dfa_hopcroft

router = APIRouter(prefix="/api/regex", tags=["Regular Expressions"])

class RegexRequest(BaseModel):
    pattern: str

@router.post("/parse", response_model=RegexParseResult)
def api_parse_regex(req: RegexRequest):
    parser = RegexParser(req.pattern)
    return parser.parse()

@router.post("/to-enfa", response_model=RegexConversionResult)
def api_regex_to_enfa(req: RegexRequest):
    try:
        return convert_regex_to_thompson(req.pattern)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/to-nfa", response_model=RegexConversionResult)
def api_regex_to_nfa(req: RegexRequest):
    try:
        return convert_regex_to_glushkov(req.pattern)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/to-dfa")
def api_regex_to_dfa(req: RegexRequest):
    try:
        enfa_res = convert_regex_to_thompson(req.pattern)
        dfa_res = convert_to_dfa_subset_construction(enfa_res.automaton)
        return {
            "regex": req.pattern,
            "intermediate_enfa": enfa_res.automaton,
            "dfa": dfa_res.converted_automaton,
            "thompson_steps": enfa_res.steps,
            "subset_steps": dfa_res.steps,
            "summary": f"Constructed DFA with {len(dfa_res.converted_automaton.states)} states from regex '{req.pattern}' via Thompson and Subset construction."
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/to-minimal-dfa")
def api_regex_to_minimal_dfa(req: RegexRequest):
    try:
        enfa_res = convert_regex_to_thompson(req.pattern)
        dfa_res = convert_to_dfa_subset_construction(enfa_res.automaton)
        min_res = minimize_dfa_hopcroft(dfa_res.converted_automaton)
        return {
            "regex": req.pattern,
            "minimal_dfa": min_res.converted_automaton,
            "minimization_steps": min_res.steps,
            "summary": f"Constructed Minimal DFA with {len(min_res.converted_automaton.states)} states from regex '{req.pattern}'."
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
