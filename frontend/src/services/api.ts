import {
  AutomatonModel, ConversionResponse, SimulationResult, BatchSimulationResponse,
  EquivalenceResponse
} from '../types/automata';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

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

  // Conversions for Dual Studios
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

  async downloadConversionPdf(payload: {
    source_automaton: AutomatonModel;
    target_automaton: AutomatonModel;
    title?: string;
    conversion_type?: string;
    state_mappings?: any[];
    epsilon_closures?: Record<string, string[]>;
    test_results?: any[];
    notes?: string;
  }): Promise<Blob> {
    const res = await fetch(`${BASE_URL}/reports/conversion-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(errText || `Server error (${res.status}): Failed to generate conversion PDF report.`);
    }
    return res.blob();
  },

  async downloadEquivalencePdf(payload: {
    dfa1: AutomatonModel;
    dfa2: AutomatonModel;
    title?: string;
    matrix_rows?: any[];
    start_match?: boolean;
    is_equivalent?: boolean;
    counterexample?: string | null;
    explanation?: string;
    notes?: string;
  }): Promise<Blob> {
    const res = await fetch(`${BASE_URL}/reports/equivalence-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(errText || `Server error (${res.status}): Failed to generate equivalence PDF report.`);
    }
    return res.blob();
  },
};


