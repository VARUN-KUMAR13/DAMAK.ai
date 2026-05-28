"use client";

import React, { useState } from "react";
import { useStore } from "@/store/useStore";
import { Sparkles, FileText, Download, Layers } from "lucide-react";
import { api } from "@/lib/api";
import ReactMarkdown from "react-markdown";

export default function NotesPanel() {
  const { currentSessionId, currentNotes, setNotes } = useStore();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("standard");

  const generateNotes = async () => {
    if (!currentSessionId) return;
    setLoading(true);
    try {
      const res = await api.post("/api/v1/intelligence/notes/generate", {
        session_id: currentSessionId,
        mode: mode
      });
      setNotes(res.data.content);
    } catch (err: any) {
      if (err.response?.status === 404) {
        alert("Session processing is not complete yet. Please wait a moment.");
      } else {
        console.error("Notes generation failed", err);
      }
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
        <div className="prose prose-invert prose-zinc max-w-none bg-zinc-950/50 border border-zinc-800 p-8 rounded-3xl shadow-2xl">
           <ReactMarkdown>{currentNotes}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
