"use client";

import React, { useState, useEffect } from "react";
import { Search, Bot, X, Send, Loader2, Quote } from "lucide-react";
import { api } from "@/lib/api";

export default function GlobalOmnibar() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [chatAnswer, setChatAnswer] = useState<string | null>(null);

  // Toggle with Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleGlobalSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setChatAnswer(null);
    setResults([]);

    try {
      // We perform global chat which uses hybrid search under the hood
      const res = await api.post("/api/v1/chat/global", {
        question: query,
        top_k: 5
      });
      setChatAnswer(res.data.answer);
      setResults(res.data.sources);
    } catch (err) {
      console.error("Global search failed", err);
      setChatAnswer("Failed to query global knowledge base.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Search Input */}
        <div className="flex items-center px-4 py-4 border-b border-zinc-800 bg-zinc-900">
          <Search className="text-zinc-400 w-6 h-6 mr-3" />
          <input
            autoFocus
            disabled
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGlobalSearch()}
            placeholder="Global Search disabled for core stabilization..."
            className="flex-1 bg-transparent text-lg text-white placeholder-zinc-500 focus:outline-none opacity-50 cursor-not-allowed"
          />
          <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-zinc-800 rounded-md text-zinc-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-950">
          {!chatAnswer && !loading && (
            <div className="text-center py-12 text-zinc-500">
              <Bot className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Type your query and press Enter to search your Global Second Brain.</p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12 text-orange-500">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="ml-3 font-medium">Synthesizing knowledge globally...</span>
            </div>
          )}

          {chatAnswer && (
            <div className="space-y-6">
              <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl">
                <div className="flex items-center gap-2 mb-4 text-orange-400 font-semibold">
                  <Bot size={20} />
                  Global AI Synthesis
                </div>
                <div className="prose prose-invert prose-zinc max-w-none text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {chatAnswer}
                </div>
              </div>

              {results.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Quote size={12} /> Source Lectures
                  </h4>
                  <div className="grid gap-3">
                    {results.map((src, i) => (
                      <div key={i} className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
                        <div className="text-xs font-mono text-zinc-500 mb-2 truncate">
                          Lecture ID: {src.job_id} | Hybrid Score: {src.score}
                        </div>
                        <div className="text-sm text-zinc-400">
                          "...{src.spoken_text}..."
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-900 flex justify-between items-center text-xs text-zinc-500">
          <div className="flex items-center gap-4">
            <span><kbd className="font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300 mr-1">Enter</kbd> to search</span>
            <span><kbd className="font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300 mr-1">Esc</kbd> to close</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-1"></span>
            Hybrid Search Active
          </div>
        </div>

      </div>
    </div>
  );
}
