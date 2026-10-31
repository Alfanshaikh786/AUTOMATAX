from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.models.automaton import AutomatonModel
from app.algorithms.automata_operations import (
    operate_union, operate_intersection, operate_complement,
    operate_difference, operate_concatenation, operate_kleene_star, operate_reversal
)

router = APIRouter(prefix="/api/operations", tags=["Automata Operations"])

class BinaryOperationRequest(BaseModel):
    automaton_a: AutomatonModel
    automaton_b: AutomatonModel

@router.post("/union", response_model=AutomatonModel)
def api_union(req: BinaryOperationRequest):
    return operate_union(req.automaton_a, req.automaton_b)

@router.post("/intersection", response_model=AutomatonModel)
def api_intersection(req: BinaryOperationRequest):
    return operate_intersection(req.automaton_a, req.automaton_b)

@router.post("/difference", response_model=AutomatonModel)
def api_difference(req: BinaryOperationRequest):
    return operate_difference(req.automaton_a, req.automaton_b)

@router.post("/concatenation", response_model=AutomatonModel)
def api_concatenation(req: BinaryOperationRequest):
    return operate_concatenation(req.automaton_a, req.automaton_b)

@router.post("/complement", response_model=AutomatonModel)
def api_complement(aut: AutomatonModel):
    return operate_complement(aut)

@router.post("/kleene-star", response_model=AutomatonModel)
def api_kleene_star(aut: AutomatonModel):
    return operate_kleene_star(aut)

@router.post("/reversal", response_model=AutomatonModel)
def api_reversal(aut: AutomatonModel):
    return operate_reversal(aut)
