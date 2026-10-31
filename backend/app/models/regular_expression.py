from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field
from app.models.automaton import AutomatonModel

class RegexNode(BaseModel):
    type: str # 'SYMBOL', 'EPSILON', 'EMPTY', 'STAR', 'PLUS', 'OPTION', 'CONCAT', 'UNION'
    value: Optional[str] = None
    left: Optional['RegexNode'] = None
    right: Optional['RegexNode'] = None
    # Glushkov position attributes
    position: Optional[int] = None
    nullable: bool = False
    firstpos: List[int] = Field(default_factory=list)
    lastpos: List[int] = Field(default_factory=list)

class RegexParseResult(BaseModel):
    pattern: str
    is_valid: bool
    ast: Optional[RegexNode] = None
    error_message: Optional[str] = None
    alphabet: List[str] = Field(default_factory=list)

class ThompsonStep(BaseModel):
    step_number: int
    operation: str
    subexpression: str
    description: str
    intermediate_automaton: AutomatonModel

class RegexConversionResult(BaseModel):
    regex: str
    automaton: AutomatonModel
    steps: List[Dict[str, Any]] = Field(default_factory=list)
    glushkov_table: Optional[Dict[str, Any]] = None
    summary: str

