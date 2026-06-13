"use client";

import React, { useState } from "react";
import { useStore } from "@/store/useStore";
import { Send, Bot, User, Quote } from "lucide-react";
import { api } from "@/lib/api";

export default function ChatPanel() {
  const { currentSessionId, sessions, setHighlightedTimestamp } = useStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("Standard");

  const currentJob = sessions.find(s => s.job_id === currentSessionId);
  const isCompleted = currentJob?.status === 'completed';

  const handleSend = async () => {
    if (!input.trim() || !currentSessionId) return;

    const userMsg = { role: "user", content: input };
    setMessages([...messages, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.post("/api/v1/chat", {
        question: input,
        job_id: currentSessionId,
        top_k: 3,
        mode: mode
      });

      const aiMsg = { 
        role: "assistant", 
        content: res.data.answer,
        sources: res.data.sources 
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error("Chat failed", err);
      const errorMsg = { 
        role: "assistant", 
        content: err.response?.data?.detail || "Error: AI engine is unavailable. Please ensure Ollama is running."
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      <div className="flex-1 space-y-6 mb-6">
        {messages.length === 0 && (
          <div className="text-center py-20">
             <Bot className="mx-auto w-12 h-12 text-zinc-700 mb-4" />
             <h3 className="text-lg font-medium text-zinc-300">AI Lecture Tutor</h3>
             {isCompleted ? (
               <p className="text-zinc-500">Ask me anything about this lecture context.</p>
             ) : (
               <div className="mt-4 inline-flex items-center gap-2 bg-orange-500/10 text-orange-400 px-4 py-2 rounded-lg border border-orange-500/20 text-sm">
                 <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                 Lecture is still processing. Knowledge base is not ready yet.
               </div>
             )}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : ''}`}>
             {m.role === 'assistant' && <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0"><Bot size={16}/></div>}
             <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${m.role === 'user' ? 'bg-white text-black' : 'bg-zinc-900 border border-zinc-800'}`}>
                <div className="leading-relaxed whitespace-pre-wrap">{m.content}</div>
             </div>
             {m.role === 'user' && <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center flex-shrink-0 text-black"><User size={16}/></div>}
          </div>
        ))}
        {loading && <div className="text-zinc-500 italic flex items-center gap-2"><Bot size={16} className="animate-pulse" /> AI is thinking...</div>}
      </div>

      <div className="sticky bottom-0 bg-background pt-4">
        <div className="relative">
           <textarea
             value={input}
             onChange={(e) => setInput(e.target.value)}
             onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && !loading && (e.preventDefault(), handleSend())}
             placeholder={isCompleted ? "Ask a question about the lecture..." : "Waiting for processing to complete..."}
             disabled={!isCompleted || loading}
             className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 pr-12 focus:outline-none focus:ring-1 focus:ring-zinc-600 resize-none disabled:opacity-50"
             rows={1}
           />
           <button 
             onClick={handleSend}
             disabled={!isCompleted || loading || !input.trim()}
             className="absolute right-3 bottom-3 p-1.5 bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
           >
             <Send size={18} />
           </button>
        </div>
        <div className="mt-2 flex justify-end">
          <select 
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          >
            <option value="Standard">Standard</option>
            <option value="Concise">Concise</option>
            <option value="Detailed">Detailed</option>
            <option value="Beginner Friendly">Beginner Friendly</option>
            <option value="Exam Preparation">Exam Preparation</option>
            <option value="Quick Summary">Quick Summary</option>
            <option value="Interactive Tutor">Interactive Tutor</option>
          </select>
        </div>
      </div>
    </div>
  );
}
