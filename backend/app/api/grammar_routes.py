from fastapi import APIRouter, HTTPException
from app.models.grammar import RightLinearGrammar, GrammarConversionResponse
from app.models.automaton import AutomatonModel
from app.algorithms.grammar_conversion import validate_right_linear_grammar, convert_grammar_to_nfa, convert_nfa_to_grammar

router = APIRouter(prefix="/api/grammar", tags=["Grammar"])

@router.post("/validate")
def api_validate_grammar(grammar: RightLinearGrammar):
    is_valid, err = validate_right_linear_grammar(grammar)
    return {
        "is_valid": is_valid,
        "error_message": err,
        "message": "Grammar is a mathematically valid Right-Linear Grammar." if is_valid else err
    }

@router.post("/to-nfa", response_model=GrammarConversionResponse)
def api_grammar_to_nfa(grammar: RightLinearGrammar):
    return convert_grammar_to_nfa(grammar)

@router.post("/from-automaton", response_model=RightLinearGrammar)
def api_automaton_to_grammar(aut: AutomatonModel):
    try:
        return convert_nfa_to_grammar(aut)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
