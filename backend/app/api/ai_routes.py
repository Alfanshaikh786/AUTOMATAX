from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, Any
from app.services.ai_service import NaturalLanguageAutomataService

router = APIRouter(prefix="/api/ai", tags=["AI Assistance"])

class AIGenerateRequest(BaseModel):
    prompt: str

@router.post("/generate-automaton")
def api_generate_automaton(req: AIGenerateRequest):
    return NaturalLanguageAutomataService.generate_from_prompt(req.prompt)

