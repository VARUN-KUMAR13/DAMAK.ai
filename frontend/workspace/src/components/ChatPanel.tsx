"use client";

import React, { useState } from "react";
import { useStore } from "@/store/useStore";
import { Send, Bot, User, Quote } from "lucide-react";
import { api } from "@/lib/api";

export default function ChatPanel() {
  const { currentSessionId, setHighlightedTimestamp } = useStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

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
        top_k: 3
      });

      const aiMsg = { 
        role: "assistant", 
        content: res.data.answer,
        sources: res.data.sources 
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error("Chat failed", err);
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
             <p className="text-zinc-500">Ask me anything about this lecture context.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : ''}`}>
             {m.role === 'assistant' && <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0"><Bot size={16}/></div>}
             <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${m.role === 'user' ? 'bg-white text-black' : 'bg-zinc-900 border border-zinc-800'}`}>
                <div className="leading-relaxed whitespace-pre-wrap">{m.content}</div>
                {m.sources && m.sources.length > 0 && (
                   <div className="mt-4 pt-4 border-t border-zinc-800 space-y-2">
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                        <Quote size={10} /> Grounded Sources
                      </div>
                      {m.sources.map((s: any, j: number) => (
                        <div 
                          key={j} 
                          onClick={() => setHighlightedTimestamp(s.start_time)}
                          className="text-xs text-zinc-400 bg-black/30 p-2 rounded border border-zinc-800 flex justify-between items-center group cursor-pointer hover:border-zinc-500"
                        >
                           <span className="truncate flex-1">...{s.spoken_text.substring(0, 50)}...</span>
                           <span className="text-[10px] font-mono ml-2 text-zinc-600 group-hover:text-white transition-colors">
                              {Math.floor(s.start_time / 60)}:{(s.start_time % 60).toFixed(0).padStart(2, '0')}
                           </span>
                        </div>
                      ))}
                   </div>
                )}
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
             onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
             placeholder="Ask a question about the lecture..."
             className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 pr-12 focus:outline-none focus:ring-1 focus:ring-zinc-600 resize-none"
             rows={1}
           />
           <button 
             onClick={handleSend}
             disabled={loading}
             className="absolute right-3 bottom-3 p-1.5 bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
           >
             <Send size={18} />
           </button>
        </div>
      </div>
    </div>
  );
}
