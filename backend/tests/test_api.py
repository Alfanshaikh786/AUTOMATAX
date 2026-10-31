import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_api_validate_and_save():
    payload = {
        "name": "API Test DFA",
        "type": "DFA",
        "states": ["q0", "q1"],
        "alphabet": ["0", "1"],
        "initial_state": "q0",
        "accepting_states": ["q1"],
        "transitions": {
            "q0": {"0": ["q1"], "1": ["q0"]},
            "q1": {"0": ["q0"], "1": ["q1"]}
        }
    }
    val_res = client.post("/api/automata/validate", json=payload)
    assert val_res.status_code == 200
    assert val_res.json()["is_valid"] is True

    save_res = client.post("/api/automata/save", json=payload)
    assert save_res.status_code == 200
    assert save_res.json()["name"] == "API Test DFA"

def test_api_regex_to_enfa():
    res = client.post("/api/regex/to-enfa", json={"pattern": "(0|1)*01"})
    assert res.status_code == 200
    data = res.json()
    assert data["automaton"]["type"] == "ENFA"
    assert len(data["automaton"]["states"]) > 0

def test_api_ai_generate():
    res = client.post("/api/ai/generate-automaton", json={"prompt": "Create a DFA that accepts binary strings with an even number of zeros"})
    assert res.status_code == 200
    data = res.json()
    assert data["is_verified"] is True
    assert data["automaton"]["type"] == "DFA"
