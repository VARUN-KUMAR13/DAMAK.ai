"use client";

import React, { useState } from "react";
import { useStore } from "@/store/useStore";
import { Sparkles, FileText, Download, Layers } from "lucide-react";
import { api } from "@/lib/api";
import ReactMarkdown from "react-markdown";

export default function NotesPanel() {
  const { currentSessionId, currentNotes, currentNotesKeyConcepts, currentNotesCitations, setNotes, setHighlightedTimestamp } = useStore();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("standard");
  const [generationDuration, setGenerationDuration] = useState<number | null>(null);

  const generateNotes = async () => {
    if (!currentSessionId) return;
    setLoading(true);
    setGenerationDuration(null);
    const t0 = Date.now();
    try {
      const res = await api.post("/api/v1/intelligence/notes/generate", {
        session_id: currentSessionId,
        mode: mode
      });
      setNotes(res.data.content, res.data.key_concepts, res.data.citations);
      setGenerationDuration((Date.now() - t0) / 1000);
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail || "An unexpected error occurred during notes generation.";
      console.error("Notes generation failed:", err);
      alert(`Notes generation failed: ${errorDetail}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadNotes = () => {
    if (!currentNotes) return;
    const blob = new Blob([currentNotes], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DAMAK_AI_Notes_${currentSessionId?.substring(0, 8) ?? "session"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
              <FileText size={20} />
           </div>
           <div>
              <h3 className="text-xl font-bold">AI Lecture Notes</h3>
              <p className="text-zinc-500 text-xs">Structured knowledge from multimodal context</p>
           </div>
        </div>
        
        <div className="flex gap-2">
           <select 
             value={mode}
             onChange={(e) => setMode(e.target.value)}
             className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
           >
              <option value="easy">Easy</option>
              <option value="standard">Standard</option>
              <option value="deep">Deep Dive</option>
              <option value="exam">Exam Focus</option>
           </select>
           <button 
             onClick={generateNotes}
             disabled={loading || !currentSessionId}
             className="flex items-center gap-2 bg-white text-black px-4 py-1.5 rounded-lg font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50"
           >
             {loading ? <Sparkles size={16} className="animate-spin" /> : <Sparkles size={16} />}
             <span>{currentNotes ? 'Regenerate' : 'Generate Notes'}</span>
           </button>
           {currentNotes && (
             <button 
               onClick={downloadNotes}
               className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors"
               title="Download Markdown"
             >
               <Download size={18} />
             </button>
           )}
        </div>
      </div>

      {!currentNotes && !loading && (
        <div className="border-2 border-dashed border-zinc-800 rounded-3xl py-20 text-center">
           <Layers className="mx-auto w-12 h-12 text-zinc-800 mb-4" />
           <p className="text-zinc-600 mb-2">No notes generated yet for this session.</p>
           <p className="text-zinc-700 text-xs">AI will use OCR slide text and transcript to build your study guide.</p>
        </div>
      )}

      {loading && (
        <div className="space-y-4 animate-pulse">
           <div className="h-8 bg-zinc-900 rounded w-1/4"></div>
           <div className="h-4 bg-zinc-900 rounded w-full"></div>
           <div className="h-4 bg-zinc-900 rounded w-full"></div>
           <div className="h-4 bg-zinc-900 rounded w-3/4"></div>
           <div className="h-40 bg-zinc-900 rounded w-full"></div>
        </div>
      )}

      {currentNotes && (
        <div className="flex gap-6">
          <div className="flex-1 prose prose-invert prose-zinc max-w-none bg-zinc-950/50 border border-zinc-800 p-8 rounded-3xl shadow-2xl">
            <ReactMarkdown>{currentNotes}</ReactMarkdown>
            {generationDuration !== null && (
               <div className="mt-8 text-xs text-zinc-500 italic text-right border-t border-zinc-800/50 pt-4">
                  Generated in {generationDuration.toFixed(1)}s
               </div>
            )}
          </div>
          
          <div className="w-64 flex flex-col gap-4">
            {currentNotesKeyConcepts && currentNotesKeyConcepts.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
                <h4 className="font-semibold text-zinc-300 mb-3 text-sm flex items-center gap-2">
                  <Sparkles size={14} className="text-purple-400" />
                  Key Concepts
                </h4>
                <div className="flex flex-wrap gap-2">
                  {currentNotesKeyConcepts.map((concept, idx) => (
                    <span key={idx} className="bg-zinc-800 text-zinc-300 text-xs px-2 py-1 rounded-md">
                      {concept}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {currentNotesCitations && currentNotesCitations.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
                <h4 className="font-semibold text-zinc-300 mb-3 text-sm flex items-center gap-2">
                  <Layers size={14} className="text-blue-400" />
                  Lecture Citations
                </h4>
                <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
                  {currentNotesCitations.map((cit, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setHighlightedTimestamp(cit.timestamp)}
                      className="text-left p-2 hover:bg-zinc-800 rounded-lg transition-colors border border-transparent hover:border-zinc-700 group"
                    >
                      <div className="text-xs font-mono text-blue-400 mb-1 group-hover:text-blue-300 transition-colors">
                        [{Math.floor(cit.timestamp / 60)}:{(cit.timestamp % 60).toString().padStart(2, '0').split('.')[0]}]
                      </div>
                      <div className="text-xs text-zinc-400 line-clamp-2">
                        {cit.text}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
