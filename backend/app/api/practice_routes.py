from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.models.automaton import AutomatonModel
from app.algorithms.equivalence import check_automata_equivalence

router = APIRouter(prefix="/api/practice", tags=["Practice & Learning"])

class Exercise(BaseModel):
    id: str
    title: str
    difficulty: str # "Beginner", "Intermediate", "Advanced"
    topic: str
    description: str
    formal_specification: str
    alphabet: List[str]
    hints: List[str]
    target_solution: AutomatonModel
    sample_tests: List[Dict[str, Any]]

CURATED_EXERCISES: List[Exercise] = [
    Exercise(
        id="ex_01",
        title="Even Number of 0s",
        difficulty="Beginner",
        topic="DFA Construction",
        description="Construct a DFA over alphabet {0, 1} that accepts all binary strings containing an even number of 0s.",
        formal_specification="L = { w ∈ {0,1}* | |w|_0 mod 2 = 0 }",
        alphabet=["0", "1"],
        hints=[
            "Hint 1: Think about the remainders when counting the number of 0s modulo 2.",
            "Hint 2: You only need 2 states: one representing an even count of 0s and one representing an odd count.",
            "Hint 3: 1s do not change the count of 0s, so they should be self-loops."
        ],
        target_solution=AutomatonModel(
            name="Even 0s Solution",
            type="DFA",
            states=["q0", "q1"],
            alphabet=["0", "1"],
            initial_state="q0",
            accepting_states=["q0"],
            transitions={
                "q0": {"0": ["q1"], "1": ["q0"]},
                "q1": {"0": ["q0"], "1": ["q1"]}
            }
        ),
        sample_tests=[
            {"input": "", "expected": True},
            {"input": "1", "expected": True},
            {"input": "0", "expected": False},
            {"input": "00", "expected": True},
            {"input": "10101", "expected": True},
            {"input": "01001", "expected": False}
        ]
    ),
    Exercise(
        id="ex_02",
        title="Ends with '01'",
        difficulty="Beginner",
        topic="NFA or DFA Construction",
        description="Construct an automaton over {0, 1} that accepts all strings ending with the suffix '01'.",
        formal_specification="L = { w ∈ {0,1}* | w ends with '01' }",
        alphabet=["0", "1"],
        hints=[
            "Hint 1: An NFA can stay in the initial state on any symbol, and guess when the suffix '01' starts.",
            "Hint 2: A minimal DFA requires 3 states: tracking suffix matched: empty, '0', or '01'."
        ],
        target_solution=AutomatonModel(
            name="Ends with 01 Solution",
            type="DFA",
            states=["q0", "q1", "q2"],
            alphabet=["0", "1"],
            initial_state="q0",
            accepting_states=["q2"],
            transitions={
                "q0": {"0": ["q1"], "1": ["q0"]},
                "q1": {"0": ["q1"], "1": ["q2"]},
                "q2": {"0": ["q1"], "1": ["q0"]}
            }
        ),
        sample_tests=[
            {"input": "01", "expected": True},
            {"input": "1101", "expected": True},
            {"input": "000", "expected": False},
            {"input": "010", "expected": False},
            {"input": "", "expected": False}
        ]
    ),
    Exercise(
        id="ex_03",
        title="Binary Number Divisible by 3",
        difficulty="Intermediate",
        topic="DFA Construction",
        description="Construct a DFA that accepts binary strings representing numbers divisible by 3 (most significant bit read first).",
        formal_specification="L = { w ∈ {0,1}* | value(w) mod 3 = 0 }",
        alphabet=["0", "1"],
        hints=[
            "Hint 1: If current value is V, reading bit b changes value to 2*V + b.",
            "Hint 2: Modulo arithmetic: (2*r + b) mod 3 gives the next remainder.",
            "Hint 3: 3 states corresponding to remainders 0, 1, and 2. Initial and accepting state is remainder 0."
        ],
        target_solution=AutomatonModel(
            name="Mod 3 Solution",
            type="DFA",
            states=["r0", "r1", "r2"],
            alphabet=["0", "1"],
            initial_state="r0",
            accepting_states=["r0"],
            transitions={
                "r0": {"0": ["r0"], "1": ["r1"]},
                "r1": {"0": ["r2"], "1": ["r0"]},
                "r2": {"0": ["r1"], "1": ["r2"]}
            }
        ),
        sample_tests=[
            {"input": "0", "expected": True},
            {"input": "11", "expected": True},     # 3
            {"input": "110", "expected": True},    # 6
            {"input": "1001", "expected": True},   # 9
            {"input": "1", "expected": False},     # 1
            {"input": "10", "expected": False},    # 2
            {"input": "100", "expected": False}    # 4
        ]
    ),
    Exercise(
        id="ex_04",
        title="Contains Substring '101'",
        difficulty="Intermediate",
        topic="Pattern Matching DFA",
        description="Construct a DFA over {0, 1} that accepts any binary string containing the substring '101'.",
        formal_specification="L = { w ∈ {0,1}* | w = x101y for x, y ∈ {0,1}* }",
        alphabet=["0", "1"],
        hints=[
            "Hint 1: States represent length of matched prefix of '101': 0, 1, 2, and 3.",
            "Hint 2: Once state 3 (matched '101') is reached, it should be an absorbing accepting state looping on 0 and 1."
        ],
        target_solution=AutomatonModel(
            name="Contains 101 Solution",
            type="DFA",
            states=["q0", "q1", "q2", "q3"],
            alphabet=["0", "1"],
            initial_state="q0",
            accepting_states=["q3"],
            transitions={
                "q0": {"0": ["q0"], "1": ["q1"]},
                "q1": {"0": ["q2"], "1": ["q1"]},
                "q2": {"0": ["q0"], "1": ["q3"]},
                "q3": {"0": ["q3"], "1": ["q3"]}
            }
        ),
        sample_tests=[
            {"input": "101", "expected": True},
            {"input": "001011", "expected": True},
            {"input": "111000", "expected": False},
            {"input": "1001", "expected": False}
        ]
    )
]

class EvaluateSubmissionRequest(BaseModel):
    exercise_id: str
    student_automaton: AutomatonModel

@router.get("/exercises")
def api_get_exercises():
    # Return exercise metadata without revealing internal solution
    return [
        {
            "id": ex.id,
            "title": ex.title,
            "difficulty": ex.difficulty,
            "topic": ex.topic,
            "description": ex.description,
            "formal_specification": ex.formal_specification,
            "alphabet": ex.alphabet,
            "hints": ex.hints,
            "sample_tests": ex.sample_tests
        }
        for ex in CURATED_EXERCISES
    ]

@router.post("/evaluate")
def api_evaluate_submission(req: EvaluateSubmissionRequest):
    exercise = next((ex for ex in CURATED_EXERCISES if ex.id == req.exercise_id), None)
    if not exercise:
        return {"is_correct": False, "score": 0, "message": "Exercise not found."}

    # Use rigorous mathematical equivalence verification against the target formal solution!
    eq_res = check_automata_equivalence(req.student_automaton, exercise.target_solution)

    if eq_res.is_equivalent:
        return {
            "is_correct": True,
            "score": 100,
            "message": "Outstanding! Your automaton accepts the exact mathematical language specified.",
            "feedback": "Mathematical equivalence verified: L(Student) = L(Target). Zero distinguishing counterexamples found.",
            "counterexample": None
        }
    else:
        return {
            "is_correct": False,
            "score": 40,
            "message": "Your automaton is not equivalent to the target language requirement.",
            "feedback": eq_res.explanation,
            "counterexample": eq_res.counterexample
        }
