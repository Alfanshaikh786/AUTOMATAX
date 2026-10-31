from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any, Optional
from app.models.automaton import AutomatonModel
from app.core.validation import validate_automaton
from app.services.project_service import (
    save_automaton, get_all_automata, get_automaton_by_id, delete_automaton, get_all_projects, create_project
)

router = APIRouter(prefix="/api/automata", tags=["Automata"])

@router.post("/validate")
def api_validate_automaton(aut: AutomatonModel):
    is_valid, errors = validate_automaton(aut)
    return {
        "is_valid": is_valid,
        "errors": errors,
        "message": "Automaton is mathematically valid." if is_valid else "; ".join(errors)
    }

@router.get("", response_model=List[AutomatonModel])
def api_get_automata(project_id: Optional[str] = None):
    return get_all_automata(project_id)

@router.get("/{automaton_id}", response_model=AutomatonModel)
def api_get_automaton(automaton_id: str):
    aut = get_automaton_by_id(automaton_id)
    if not aut:
        raise HTTPException(status_code=404, detail=f"Automaton with ID '{automaton_id}' not found.")
    return aut

@router.post("/save", response_model=AutomatonModel)
def api_save_automaton(aut: AutomatonModel, project_id: str = "proj_default"):
    is_valid, errors = validate_automaton(aut)
    if not is_valid:
        raise HTTPException(status_code=400, detail="; ".join(errors))
    return save_automaton(aut, project_id)

@router.delete("/{automaton_id}")
def api_delete_automaton(automaton_id: str):
    success = delete_automaton(automaton_id)
    if not success:
        raise HTTPException(status_code=404, detail="Automaton not found.")
    return {"message": "Automaton deleted successfully."}

@router.get("/projects/all")
def api_get_projects():
    return get_all_projects()

@router.post("/projects/create")
def api_create_project(name: str, description: str = ""):
    return create_project(name, description)

