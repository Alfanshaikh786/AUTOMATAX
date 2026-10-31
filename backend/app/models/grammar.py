from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

class GrammarProduction(BaseModel):
    head: str # Non-terminal, e.g. "S"
    body: str # e.g. "0A", "1", "ε"

class RightLinearGrammar(BaseModel):
    non_terminals: List[str] = Field(default_factory=list) # e.g. ["S", "A", "B"]
    terminals: List[str] = Field(default_factory=list)     # e.g. ["0", "1"]
    start_symbol: str = "S"
    productions: List[GrammarProduction] = Field(default_factory=list)
    description: Optional[str] = ""

class GrammarConversionResponse(BaseModel):
    grammar: RightLinearGrammar
    is_valid: bool
    error_message: Optional[str] = None
    automaton: Optional[Any] = None
    steps: List[Dict[str, Any]] = Field(default_factory=list)
    summary: str
