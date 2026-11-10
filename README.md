# AutomataX — The Intelligent Automata Construction, Conversion & Verification Laboratory

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4+-38B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![ReportLab](https://img.shields.io/badge/ReportLab-PDF_Engine-FF6F00.svg?style=flat)](https://www.reportlab.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**AutomataX** is a unified computational laboratory and interactive platform for automata theory, formal languages, and computational mathematics. It bridges interactive visual graph construction, synchronized transition tables, step-by-step conversion laboratories, state-pairing equivalence verification, and publication-ready academic PDF reporting.

---

## 1. Core Architecture

```
AutomataX/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI application with CORS, lifespan & router registration
│   │   ├── core/
│   │   │   ├── automaton_types.py      # Enums for automata, algorithms, and issue severities
│   │   │   ├── validation.py           # Mathematical validation of DFA, NFA, and ε-NFA 5-tuples
│   │   │   └── exceptions.py           # Structured computational error classes
│   │   ├── models/
│   │   │   ├── automaton.py            # Pydantic models with transition normalization and layout metadata
│   │   │   ├── regular_expression.py   # Regex AST nodes and Glushkov metadata
│   │   │   └── grammar.py              # Right-linear grammar and production models
│   │   ├── algorithms/
│   │   │   ├── epsilon_closure.py      # DFS/BFS ε-closure calculation with cycle detection
│   │   │   ├── epsilon_elimination.py  # ε-NFA → NFA transformation algorithm
│   │   │   ├── subset_construction.py  # Reachable subset construction (NFA / ε-NFA → DFA)
│   │   │   ├── minimization.py         # Hopcroft's partition refinement DFA minimization
│   │   │   ├── equivalence.py          # Cartesian product automaton BFS for shortest counterexample
│   │   │   ├── regex_parser.py         # Recursive-descent AST parser for regular expressions
│   │   │   ├── thompson_glushkov.py    # Thompson ε-NFA & Glushkov position-based NFA
│   │   │   ├── state_elimination.py    # GNFA state elimination: DFA/NFA/ENFA → Regular Expression
│   │   │   ├── grammar_conversion.py   # Right-linear grammar ↔ NFA conversions
│   │   │   └── automata_operations.py  # Union, Intersection, Complement, Difference, Concatenation, Star, Reversal
│   │   ├── simulation/
│   │   │   └── simulator.py            # Step-by-step string simulation with active state sets
│   │   ├── optimization/
│   │   │   └── debugger.py             # Diagnostic engine: unreachable, dead states, non-determinism
│   │   ├── services/
│   │   │   ├── ai_service.py           # Natural-language to DFA synthesizer with deterministic verification
│   │   │   ├── report_service.py       # ReportLab PDF report generator for conversions & equivalence
│   │   │   └── project_service.py      # SQLite storage for persistent automata
│   │   └── api/
│   │       ├── automata_routes.py      # CRUD, persistence, validation
│   │       ├── conversion_routes.py    # Conversion endpoints with step tracing
│   │       ├── equivalence_routes.py   # Formal language equivalence verification
│   │       ├── reports_routes.py       # PDF report generation (RFC 5987/6266 HTTP headers)
│   │       ├── simulation_routes.py    # Single and batch string simulation
│   │       ├── regex_routes.py         # Regex AST, Thompson, Glushkov, GNFA
│   │       ├── grammar_routes.py       # Grammar validation and conversions
│   │       ├── operations_routes.py    # Set-theoretic language operations
│   │       ├── debugger_routes.py      # Automaton diagnostics & fixes
│   │       ├── ai_routes.py            # AI natural language synthesizer
│   │       └── practice_routes.py      # Challenge academy and automated grader
│   └── tests/
│       ├── test_automata_algorithms.py # Mathematical unit test suite
│       ├── test_api.py                 # FastAPI integration tests
│       └── test_nfa_multi_dest.py      # Non-deterministic transition tests
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── graph/
│   │   │   │   └── AutomataCanvas.tsx  # Interactive SVG graph canvas (drag, pan, zoom, curved edges)
│   │   │   ├── tables/
│   │   │   │   └── TransitionTable.tsx # Synchronized multi-destination transition table
│   │   │   ├── studio/
│   │   │   │   └── DualAutomataStudio.tsx # Dual conversion studio (NFA → DFA, ε-NFA → NFA/DFA)
│   │   │   ├── equivalence/
│   │   │   │   └── EquivalenceView.tsx # 3-Step textbook DFA equivalence checker & Cartesian matrix
│   │   │   ├── simulator/
│   │   │   │   └── SimulationPane.tsx  # Interactive string simulator with path trace & batch tests
│   │   │   └── ai/
│   │   │       └── AIGeneratorModal.tsx# AI Natural Language to DFA modal dialog
│   │   ├── services/
│   │   │   └── api.ts                  # Typed TypeScript REST client
│   │   ├── types/
│   │   │   └── automata.ts             # Type definitions for automata, steps, and matrices
│   │   ├── App.tsx                     # Master laboratory dashboard layout
│   │   ├── main.tsx                    # React DOM root entry point
│   │   └── index.css                   # Tailwind CSS styling and theme
│   ├── vite.config.ts                  # Vite development server configuration
│   └── package.json                    # Frontend dependencies and build scripts
├── start_backend.bat                   # Batch script to launch FastAPI server
├── start_frontend.bat                  # Batch script to launch Vite dev server
└── start_all.bat                       # Batch script to launch full stack
```

---

## 2. Key Modules & Features

### A. Interactive Automata Builder
- **Visual Graph Canvas**: Dynamic SVG-based canvas rendering states, initial state indicator arrows ($\to q_0$), double-ring final states, curved directed transitions, self-loops, and multi-symbol edge labels.
- **Synchronized Transition Table**: Real-time two-way synchronization between visual graph nodes and tabular mathematical transition entries.
- **Direct Multi-Type Support**: Seamlessly build **DFA**, **NFA** (with multiple destination sets $\{q_1, q_2\}$), and **$\varepsilon$-NFA** (with spontaneous $\varepsilon$ transitions).

### B. Dual Automata Conversion Studios
Three specialized laboratories for algorithmic transformation:
1. **Dual NFA Studio (NFA $\to$ DFA)**:
   - Reachable subset construction algorithm.
   - Computes state power-set mappings with mathematical derivations: $\delta_D([q_0, q_1], a) = \delta_N(q_0, a) \cup \delta_N(q_1, a)$.
   - Auto-generates complete dead state ($\emptyset$) handling for missing transitions.
   - Live dual-machine acceptance test suite comparing string acceptance between source NFA and target DFA.
2. **Dual $\varepsilon$-NFA Studio ($\varepsilon$-NFA $\to$ NFA)**:
   - Epsilon-elimination algorithm via:
     $$\delta'(q, a) = \varepsilon\text{-closure}(\delta(\varepsilon\text{-closure}(q), a))$$
   - Displays full $\varepsilon$-closure sets for every state.
3. **Dual $\varepsilon$-NFA Studio ($\varepsilon$-NFA $\to$ DFA)**:
   - Direct subset construction on $\varepsilon$-closures without intermediate conversion.

### C. DFA Equivalence Checker (Textbook 3-Step Method)
Rigorous state-pairing equivalence checker following formal theoretical computer science curriculum:
- **Step 1: Initial State & Acceptance Status Check**:
  - Compares $q_{01}$ and $q_{02}$ to ensure both are either Final States (FS) or Non-Final Intermediate States (IS).
- **Step 2: State-Pair Cartesian Cross-Product Transition Table ($Q_1 \times Q_2$)**:
  - Explores reachable state pairs $(q_i, q_j)$ starting from $(q_{01}, q_{02})$.
  - Evaluates transitions for each alphabet symbol:
    $$\delta((q_i, q_j), a) = (\delta_1(q_i, a), \delta_2(q_j, a))$$
  - Marks state pair categories (`FS FS`, `IS IS`, or mismatching `FS IS` / `IS FS`).
  - Highlights newly discovered pairs (`[New]`) and flags conflicting pairs (`[MISMATCH ✗]`).
- **Step 3: Final Equivalence Verdict & Counterexample**:
  - Outputs a clear verdict: *Both the DFAs are equivalent to each other* or *The DFAs are NOT equivalent*.
  - When non-equivalent, generates the **shortest distinguishing counterexample string** $w$ with step-by-step path divergence traces.
- **Interactive Controls**:
  - Add/delete states, symbols, final states, and individual transitions for each machine.
  - Auto-Dead State ($\emptyset$) completion toggle.
  - Reset to textbook benchmark presets with one click.

### D. String Acceptance Simulator
- Single-string step-by-step tracer highlighting active states and traversed transitions.
- Multi-string batch simulation suite with pass/fail evaluation against expected outcomes.
- Detailed step logs with execution paths and rejection explanations.

### E. AI Automata Synthesizer (Natural Language $\to$ DFA)
- Translates plain English specifications (e.g. *"Binary strings containing an odd number of 1s and ending with 0"*) into mathematically verified automata.
- Powered by Google Gemini with deterministic structural validation and canonicalization.

### F. Academic PDF Reporting Engine
- **Native ReportLab Generation**: Compiles publication-grade, multi-page vector PDF reports.
- **Conversion Laboratory Reports**:
  - Formal 5-tuple specifications $M = (Q, \Sigma, \delta, q_0, F)$ for source and target machines.
  - Transition tables (including $\varepsilon$ columns where applicable).
  - Reachability $\varepsilon$-closure tables.
  - Subset state mapping derivations and transition formulas.
  - Empirical string acceptance test suite comparison.
- **Equivalence Verification Reports**:
  - 5-tuple definitions of DFA 1 and DFA 2.
  - Step 1 initial state status verification.
  - Step 2 2D Cartesian product state-pair matrix table with color-coded match status.
  - Step 3 final verdict with counterexample analysis.
- **HTTP & Browser Compliant**:
  - RFC 5987 / RFC 6266 compliant `Content-Disposition` headers with safe ASCII fallbacks for Greek letters ($\varepsilon, \Sigma, \delta$) and symbols ($\emptyset$).
  - Non-blocking browser download trigger with deferred blob URL revocation.

---

## 3. REST API Reference

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/api/automata` | List all saved automata |
| `POST` | `/api/automata` | Save or update an automaton |
| `GET` | `/api/automata/{id}` | Retrieve automaton by ID |
| `POST` | `/api/automata/validate` | Mathematically validate a 5-tuple definition |
| `POST` | `/api/conversions/nfa-to-dfa` | Subset construction with step-by-step trace |
| `POST` | `/api/conversions/enfa-to-nfa` | $\varepsilon$-elimination conversion |
| `POST` | `/api/conversions/minimize` | Hopcroft DFA minimization |
| `POST` | `/api/equivalence/verify` | Cartesian product BFS language equivalence |
| `POST` | `/api/simulation/simulate` | Single string acceptance trace |
| `POST` | `/api/simulation/batch` | Batch string acceptance testing |
| `POST` | `/api/ai/generate-automaton` | AI natural-language prompt synthesizer |
| `POST` | `/api/reports/pdf` | Generate PDF report for a single automaton |
| `POST` | `/api/reports/conversion-pdf` | Generate comprehensive conversion laboratory PDF |
| `POST` | `/api/reports/equivalence-pdf` | Generate 3-step DFA equivalence verification PDF |

Interactive Swagger documentation is accessible live at `http://127.0.0.1:8000/docs`.

---

## 4. Installation & Quickstart

### Prerequisites
- **Python 3.10+** (tested on Python 3.10 – 3.14)
- **Node.js 18+** (tested on Node.js v20 – v26)
- **npm** or **pnpm**

### Quick Launch (Windows)
Double-click `start_all.bat` or run in terminal:
```cmd
start_all.bat
```
This automatically starts:
- **FastAPI Backend**: `http://127.0.0.1:8000`
- **Vite React Frontend**: `http://localhost:5173`

---

### Manual Startup

#### 1. Backend Server Setup
```bash
cd backend
python -m venv venv

# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

#### 3. Running Test Suites
Run the backend mathematical verification tests:
```bash
cd backend
venv\Scripts\pytest.exe -v
```

Build the frontend production bundle:
```bash
cd frontend
npm run build
```

---

## 5. Technology Stack

- **Backend**: Python, FastAPI, Uvicorn, Pydantic v2, ReportLab, SQLite
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React, Dagre Graph Layout
- **Testing**: Pytest, FastAPI TestClient, Vitest

---

## 6. License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
