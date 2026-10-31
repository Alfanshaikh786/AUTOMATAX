import sqlite3
import json
import os
import time
from typing import List, Dict, Optional, Any
from app.models.automaton import AutomatonModel
from app.core.automaton_types import AutomatonType

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "automata_lab.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at REAL,
        updated_at REAL
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS automata (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at REAL,
        updated_at REAL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS practice_progress (
        exercise_id TEXT PRIMARY KEY,
        difficulty TEXT,
        completed INTEGER DEFAULT 0,
        score INTEGER DEFAULT 0,
        attempts INTEGER DEFAULT 0,
        last_attempt_at REAL
    )
    """)

    conn.commit()
    conn.close()

    # Pre-seed default project and sample automata if empty
    seed_samples_if_needed()

def seed_samples_if_needed():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM automata")
    count = cursor.fetchone()[0]

    if count == 0:
        now = time.time()
        # Default project
        cursor.execute("INSERT OR IGNORE INTO projects VALUES (?, ?, ?, ?, ?)", (
            "proj_default", "Automata Theory Examples", "Curated academic benchmark automata for learning and testing.", now, now
        ))

        # Sample 1: Even zeros DFA
        s1 = AutomatonModel(
            id="sample_even_zeros",
            name="Even Zeros DFA",
            type=AutomatonType.DFA,
            states=["q0", "q1"],
            alphabet=["0", "1"],
            initial_state="q0",
            accepting_states=["q0"],
            transitions={
                "q0": {"0": ["q1"], "1": ["q0"]},
                "q1": {"0": ["q0"], "1": ["q1"]}
            },
            description="Accepts strings over {0,1} with an even number of '0's."
        )

        # Sample 2: Ends with 01 NFA
        s2 = AutomatonModel(
            id="sample_ends_01",
            name="Ends With 01 NFA",
            type=AutomatonType.NFA,
            states=["q0", "q1", "q2"],
            alphabet=["0", "1"],
            initial_state="q0",
            accepting_states=["q2"],
            transitions={
                "q0": {"0": ["q0", "q1"], "1": ["q0"]},
                "q1": {"1": ["q2"]}
            },
            description="NFA that nondeterministically guesses the beginning of suffix '01'."
        )

        # Sample 3: Divisible by 3 Binary DFA
        s3 = AutomatonModel(
            id="sample_mod_3",
            name="Divisible by 3 DFA",
            type=AutomatonType.DFA,
            states=["r0", "r1", "r2"],
            alphabet=["0", "1"],
            initial_state="r0",
            accepting_states=["r0"],
            transitions={
                "r0": {"0": ["r0"], "1": ["r1"]},
                "r1": {"0": ["r2"], "1": ["r0"]},
                "r2": {"0": ["r1"], "1": ["r2"]}
            },
            description="Accepts binary representations of integers divisible by 3."
        )

        # Sample 4: Epsilon-NFA for (a|b)*abb
        s4 = AutomatonModel(
            id="sample_enfa_abb",
            name="ENFA for (a|b)*abb",
            type=AutomatonType.ENFA,
            states=["q0", "q1", "q2", "q3", "q4"],
            alphabet=["a", "b"],
            initial_state="q0",
            accepting_states=["q4"],
            transitions={
                "q0": {},
                "q1": {"a": ["q2"]},
                "q2": {"b": ["q3"]},
                "q3": {"b": ["q4"]}
            },
            epsilon_transitions={
                "q0": ["q0", "q1"]
            },
            description="ε-NFA illustrating epsilon branching before terminal matching."
        )

        for s in [s1, s2, s3, s4]:
            cursor.execute(
                "INSERT OR REPLACE INTO automata VALUES (?, ?, ?, ?, ?, ?, ?)",
                (s.id, "proj_default", s.name, s.type.value, json.dumps(s.model_dump()), now, now)
            )

        conn.commit()
    conn.close()

def get_all_projects() -> List[Dict[str, Any]]:
    init_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM projects ORDER BY updated_at DESC")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

def create_project(name: str, description: str = "") -> Dict[str, Any]:
    init_db()
    pid = f"proj_{int(time.time()*1000)}"
    now = time.time()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO projects VALUES (?, ?, ?, ?, ?)", (pid, name, description, now, now))
    conn.commit()
    conn.close()
    return {"id": pid, "name": name, "description": description, "created_at": now, "updated_at": now}

def save_automaton(aut: AutomatonModel, project_id: str = "proj_default") -> AutomatonModel:
    init_db()
    now = time.time()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO automata (id, project_id, name, type, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        type=excluded.type,
        data=excluded.data,
        updated_at=excluded.updated_at
    """, (aut.id, project_id, aut.name, aut.type.value, json.dumps(aut.model_dump()), now, now))
    conn.commit()
    conn.close()
    return aut

def get_all_automata(project_id: Optional[str] = None) -> List[AutomatonModel]:
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    if project_id:
        cursor.execute("SELECT data FROM automata WHERE project_id = ? ORDER BY updated_at DESC", (project_id,))
    else:
        cursor.execute("SELECT data FROM automata ORDER BY updated_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [AutomatonModel(**json.loads(r[0])) for r in rows]

def get_automaton_by_id(aid: str) -> Optional[AutomatonModel]:
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT data FROM automata WHERE id = ?", (aid,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return AutomatonModel(**json.loads(row[0]))
    return None

def delete_automaton(aid: str) -> bool:
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM automata WHERE id = ?", (aid,))
    changed = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return changed

