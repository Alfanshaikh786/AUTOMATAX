import {
  AutomatonModel, ConversionResponse, SimulationResult, BatchSimulationResponse,
  EquivalenceResponse, DebugReport, RightLinearGrammar, Exercise
} from '../types/automata';

const BASE_URL = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorText = await res.text();
    let detail = errorText;
    try {
      const parsed = JSON.parse(errorText);
      detail = parsed.detail || parsed.message || errorText;
    } catch {
      // ignore
    }
    throw new Error(detail || `HTTP Error ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Automata Management
  async validate(automaton: AutomatonModel): Promise<{ is_valid: boolean; errors: string[]; message: string }> {
    const res = await fetch(`${BASE_URL}/automata/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(automaton),
    });
    return handleResponse(res);
  },

  async getAll(): Promise<AutomatonModel[]> {
    const res = await fetch(`${BASE_URL}/automata`);
    return handleResponse(res);
  },

  async getById(id: string): Promise<AutomatonModel> {
    const res = await fetch(`${BASE_URL}/automata/${id}`);
    return handleResponse(res);
  },

  async save(automaton: AutomatonModel): Promise<AutomatonModel> {
    const res = await fetch(`${BASE_URL}/automata/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(automaton),
    });
    return handleResponse(res);
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/automata/${id}`, { method: 'DELETE' });
    return handleResponse(res);
  },

  // Conversions
  async convertEnfaToNfa(aut: AutomatonModel): Promise<ConversionResponse> {
    const res = await fetch(`${BASE_URL}/conversions/enfa-to-nfa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aut),
    });
    return handleResponse(res);
  },

  async convertToDfa(aut: AutomatonModel): Promise<ConversionResponse> {
    const res = await fetch(`${BASE_URL}/conversions/to-dfa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aut),
    });
    return handleResponse(res);
  },

  async minimizeDfa(aut: AutomatonModel): Promise<ConversionResponse> {
    const res = await fetch(`${BASE_URL}/conversions/minimize-dfa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aut),
    });
    return handleResponse(res);
  },

  async convertDfaToNfa(aut: AutomatonModel): Promise<ConversionResponse> {
    const res = await fetch(`${BASE_URL}/conversions/dfa-to-nfa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aut),
    });
    return handleResponse(res);
  },

  async convertToEnfa(aut: AutomatonModel): Promise<ConversionResponse> {
    const res = await fetch(`${BASE_URL}/conversions/to-enfa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aut),
    });
    return handleResponse(res);
  },

  async convertToRegex(aut: AutomatonModel): Promise<{ regex: string; steps: any[]; summary: string }> {
    const res = await fetch(`${BASE_URL}/conversions/to-regex`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aut),
    });
    return handleResponse(res);
  },

  // Regex Lab
  async parseRegex(pattern: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/regex/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern }),
    });
    return handleResponse(res);
  },

  async regexToEnfa(pattern: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/regex/to-enfa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern }),
    });
    return handleResponse(res);
  },

  async regexToNfa(pattern: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/regex/to-nfa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern }),
    });
    return handleResponse(res);
  },

  async regexToDfa(pattern: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/regex/to-dfa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern }),
    });
    return handleResponse(res);
  },

  async regexToMinimalDfa(pattern: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/regex/to-minimal-dfa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern }),
    });
    return handleResponse(res);
  },

  // Grammar Lab
  async validateGrammar(grammar: RightLinearGrammar): Promise<any> {
    const res = await fetch(`${BASE_URL}/grammar/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(grammar),
    });
    return handleResponse(res);
  },

  async grammarToNfa(grammar: RightLinearGrammar): Promise<any> {
    const res = await fetch(`${BASE_URL}/grammar/to-nfa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(grammar),
    });
    return handleResponse(res);
  },

  async automatonToGrammar(aut: AutomatonModel): Promise<RightLinearGrammar> {
    const res = await fetch(`${BASE_URL}/grammar/from-automaton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aut),
    });
    return handleResponse(res);
  },

  // Operations
  async performOperation(operation: string, autA: AutomatonModel, autB?: AutomatonModel): Promise<AutomatonModel> {
    if (operation === 'complement') {
      const res = await fetch(`${BASE_URL}/operations/complement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(autA),
      });
      return handleResponse(res);
    }
    if (operation === 'kleene-star') {
      const res = await fetch(`${BASE_URL}/operations/kleene-star`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(autA),
      });
      return handleResponse(res);
    }
    if (operation === 'reversal') {
      const res = await fetch(`${BASE_URL}/operations/reversal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(autA),
      });
      return handleResponse(res);
    }

    const res = await fetch(`${BASE_URL}/operations/${operation}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ automaton_a: autA, automaton_b: autB }),
    });
    return handleResponse(res);
  },

  // Simulation
  async simulate(automaton: AutomatonModel, inputString: string): Promise<SimulationResult> {
    const res = await fetch(`${BASE_URL}/simulation/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ automaton, input_string: inputString }),
    });
    return handleResponse(res);
  },

  async batchSimulate(automaton: AutomatonModel, testStrings: string[]): Promise<BatchSimulationResponse> {
    const res = await fetch(`${BASE_URL}/simulation/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ automaton, test_strings: testStrings }),
    });
    return handleResponse(res);
  },

  // Equivalence
  async verifyEquivalence(autA: AutomatonModel, autB: AutomatonModel): Promise<EquivalenceResponse> {
    const res = await fetch(`${BASE_URL}/equivalence/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ automaton_a: autA, automaton_b: autB }),
    });
    return handleResponse(res);
  },

  // Debugger
  async analyze(automaton: AutomatonModel): Promise<DebugReport> {
    const res = await fetch(`${BASE_URL}/debugger/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(automaton),
    });
    return handleResponse(res);
  },

  // AI Generator
  async generateFromPrompt(prompt: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/ai/generate-automaton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    return handleResponse(res);
  },

  // Reports
  async downloadPdf(automaton: AutomatonModel, title?: string, notes?: string): Promise<Blob> {
    const res = await fetch(`${BASE_URL}/reports/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ automaton, title, notes }),
    });
    if (!res.ok) throw new Error("Failed to generate PDF report.");
    return res.blob();
  },

  // Practice
  async getExercises(): Promise<Exercise[]> {
    const res = await fetch(`${BASE_URL}/practice/exercises`);
    return handleResponse(res);
  },

  async evaluateSubmission(exerciseId: string, studentAutomaton: AutomatonModel): Promise<any> {
    const res = await fetch(`${BASE_URL}/practice/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exercise_id: exerciseId, student_automaton: studentAutomaton }),
    });
    return handleResponse(res);
  }
};

