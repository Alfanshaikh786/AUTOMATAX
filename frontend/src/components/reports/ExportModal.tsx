import React, { useState } from 'react';
import { AutomatonModel } from '../../types/automata';
import { api } from '../../services/api';
import { Download, FileText, Code2, Image, FileSpreadsheet, X, Check } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  automaton: AutomatonModel;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  automaton,
}) => {
  const [reportTitle, setReportTitle] = useState(`${automaton.name} Academic Report`);
  const [instructorNotes, setInstructorNotes] = useState('');
  const [loadingPdf, setLoadingPdf] = useState(false);

  if (!isOpen) return null;

  // Export JSON
  const handleExportJson = () => {
    const dataStr = JSON.stringify(automaton, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${automaton.name.replace(/\s+/g, '_')}.json`;
    a.click();
  };

  // Export CSV Transition Table
  const handleExportCsv = () => {
    const isEnfa = automaton.type === 'ENFA';
    const headers = ['State', ...automaton.alphabet, ...(isEnfa ? ['ε'] : []), 'IsInitial', 'IsAccepting'];
    const rows = [headers.join(',')];

    automaton.states.forEach((s) => {
      const row = [s];
      automaton.alphabet.forEach((sym) => {
        const dests = automaton.transitions[s]?.[sym] || [];
        row.push(`"${dests.join(';') || '∅'}"`);
      });
      if (isEnfa) {
        const epsDests = automaton.epsilon_transitions[s] || [];
        row.push(`"${epsDests.join(';') || '∅'}"`);
      }
      row.push(s === automaton.initial_state ? 'TRUE' : 'FALSE');
      row.push(automaton.accepting_states.includes(s) ? 'TRUE' : 'FALSE');
      rows.push(row.join(','));
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${automaton.name.replace(/\s+/g, '_')}_table.csv`;
    a.click();
  };

  // Download PDF Report
  const handleDownloadPdf = async () => {
    try {
      setLoadingPdf(true);
      const blob = await api.downloadPdf(automaton, reportTitle, instructorNotes);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${automaton.name.replace(/\s+/g, '_')}_report.pdf`;
      a.click();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-4 text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-base">
            <Download className="w-5 h-5" />
            <span>Export & Academic Publication Center</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Academic PDF Report Config */}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-white font-semibold text-xs">
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>Generate Academic PDF Verification Report</span>
          </div>
          <input
            type="text"
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            placeholder="Report title..."
            className="bg-slate-900 border border-slate-750 rounded p-2 text-xs font-sans text-slate-100 outline-none focus:border-cyan-500"
          />
          <textarea
            rows={2}
            value={instructorNotes}
            onChange={(e) => setInstructorNotes(e.target.value)}
            placeholder="Optional instructor or laboratory notes to append to PDF..."
            className="bg-slate-900 border border-slate-750 rounded p-2 text-xs font-sans text-slate-100 outline-none focus:border-cyan-500"
          />
          <button
            onClick={handleDownloadPdf}
            disabled={loadingPdf}
            className="w-full py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded font-semibold text-xs text-white transition flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            {loadingPdf ? "Compiling PDF Report..." : "Download Formal Academic PDF"}
          </button>
        </div>

        {/* Data Exports Grid */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleExportJson}
            className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl flex items-center gap-2.5 transition text-left"
          >
            <Code2 className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-xs font-semibold text-white">JSON Automaton</div>
              <div className="text-[10px] text-slate-400">Canonical format</div>
            </div>
          </button>

          <button
            onClick={handleExportCsv}
            className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl flex items-center gap-2.5 transition text-left"
          >
            <FileSpreadsheet className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-xs font-semibold text-white">CSV Transition Table</div>
              <div className="text-[10px] text-slate-400">Spreadsheet table</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

