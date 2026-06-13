"use client";

import { MessageSquare, ChevronRight, BookOpen, Sparkles, Loader2, AlertCircle, FileText, CheckCircle2, ArrowRight, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { useTutorStore } from "../../../../store/tutor.store";
import ReactMarkdown from "react-markdown";

export interface TutorPanelProps {
  jobId?: string;
  isOpenMobile?: boolean;
}

const RESPONSE_STYLES = [
  { id: "Concise", label: "Concise", desc: "Short & clear" },
  { id: "Standard", label: "Standard", desc: "Balanced" },
  { id: "Detailed", label: "Detailed", desc: "In-depth" }
];

const TONES = [
  { id: "Professional", label: "Professional" },
  { id: "Friendly", label: "Friendly" },
  { id: "Simplified", label: "Simplified" }
];

export function TutorPanel({ jobId, isOpenMobile = false }: TutorPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { sessions, initSession, sendMessage, setResponseStyle, setTone } = useTutorStore();
  
  useEffect(() => {
    if (jobId) {
      initSession(jobId);
    }
  }, [jobId, initSession]);

  const sessionState = jobId ? sessions[jobId] : null;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sessionState?.messages, sessionState?.isTyping]);

  if (!jobId || !sessionState) {
    return (
      <aside className={`w-[450px] flex-col shrink-0 z-20 bg-[#0f0f0f] border-l border-white/5 hidden lg:flex`}>
         <div className="p-6 animate-pulse space-y-4 mt-16">
            <div className="h-16 bg-white/5 rounded-xl w-3/4"></div>
            <div className="h-12 bg-white/5 rounded-xl w-1/2 self-end"></div>
         </div>
      </aside>
    );
  }

  const { messages, isTyping, typingStatus, error, responseStyle, tone } = sessionState;

  const handleSend = (text: string) => {
    if (!text.trim() || isTyping) return;
    sendMessage(jobId, text);
    setInput("");
  };

  const baseClasses = "w-[450px] flex-col shrink-0 z-40 bg-[#111111] border-l border-white/5 shadow-[-20px_0_40px_-10px_rgba(0,0,0,0.5)] h-full fixed lg:static right-0 top-0 bottom-0";
  const mobileVisibility = isOpenMobile ? "flex translate-x-0" : "translate-x-full lg:translate-x-0 hidden lg:flex";

  return (
    <aside className={`${baseClasses} ${mobileVisibility} transition-transform duration-300 font-sans`}>
      
      {/* Scrollable Container */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col p-6 space-y-8 pb-32">
        
        {/* Header */}
        <div className="flex items-start gap-4">
          <Sparkles className="w-6 h-6 text-primary mt-1" />
          <div>
            <h2 className="text-xl font-semibold text-white tracking-wide font-display">AI Tutor</h2>
            <p className="text-sm text-zinc-400">Your learning companion</p>
          </div>
        </div>

        {/* Configuration Toggles */}
        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium text-zinc-300">Response Style</label>
            <div className="grid grid-cols-3 gap-2">
              {RESPONSE_STYLES.map(style => (
                <button
                  key={style.id}
                  onClick={() => setResponseStyle(jobId, style.id)}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                    responseStyle === style.id 
                      ? 'border-primary bg-primary/10' 
                      : 'border-white/5 bg-transparent hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-sm font-medium ${responseStyle === style.id ? 'text-white' : 'text-zinc-300'}`}>
                      {style.label}
                    </span>
                    {responseStyle === style.id && <CheckCircle2 className="w-4 h-4 text-primary opacity-80" />}
                  </div>
                  <span className={`text-xs mt-1 ${responseStyle === style.id ? 'text-primary/70' : 'text-zinc-500'}`}>
                    {style.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-zinc-300">Tone</label>
            <div className="grid grid-cols-3 gap-2">
              {TONES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTone(jobId, t.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    tone === t.id 
                      ? 'border-primary bg-primary/10' 
                      : 'border-white/5 bg-transparent hover:border-white/20'
                  }`}
                >
                  <span className={`text-sm font-medium ${tone === t.id ? 'text-white' : 'text-zinc-300'}`}>
                    {t.label}
                  </span>
                  {tone === t.id && <CheckCircle2 className="w-4 h-4 text-primary opacity-80" />}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Chat Area */}
        <div className="space-y-6">
          {messages.map((msg) => (
            <motion.div 
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div 
                className={`p-5 rounded-2xl max-w-[95%] text-[15px] ${
                  msg.role === 'user' 
                    ? 'bg-[#352055] text-white rounded-br-sm shadow-lg' 
                    : 'bg-transparent text-zinc-200 border border-white/10 rounded-bl-sm prose prose-invert prose-p:leading-relaxed prose-sm prose-a:text-primary prose-strong:text-white prose-ul:my-2 prose-li:my-1'
                }`}
              >
                <ReactMarkdown>{msg.content}</ReactMarkdown>
                
                {/* Citations/Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-2">
                    {msg.sources.map((s, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-black/40 border border-white/5 rounded text-[10px] text-muted-foreground font-medium cursor-help" title={`Chunk ID: ${s.chunk_id}`}>
                        <FileText className="w-3 h-3 text-primary/70" />
                        Ref {idx + 1}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {/* Dynamic Thinking State */}
          {isTyping && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3"
            >
              <div className="p-4 rounded-2xl bg-transparent border border-white/10 text-zinc-400 rounded-bl-sm flex items-center gap-3 text-[15px]">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                {typingStatus || "Thinking..."}
              </div>
            </motion.div>
          )}

          {/* Error State */}
          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-[15px] flex items-start gap-3 w-full"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div className="flex-1">
                <span className="font-semibold block mb-1">Mentor Error</span>
                {error}
              </div>
            </motion.div>
          )}

          {/* Suggested Actions */}
          {!isTyping && messages.length > 0 && messages[messages.length - 1].role === "assistant" && !error && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-8 space-y-4"
            >
              <label className="text-sm font-medium text-zinc-300 mb-2 block">Follow-up suggestions</label>
              <div className="space-y-2">
                <button onClick={() => handleSend("Can you explain that simpler?")} className="w-full p-4 rounded-xl border border-white/10 bg-transparent hover:bg-white/5 text-left transition-colors flex items-center justify-between group focus-visible:ring-2 focus-visible:ring-primary">
                  <span className="text-[15px] text-zinc-300 group-hover:text-white">Can you explain that simpler?</span>
                  <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-primary transition-colors" />
                </button>
                <button onClick={() => handleSend("Quiz me on this topic")} className="w-full p-4 rounded-xl border border-white/10 bg-transparent hover:bg-white/5 text-left transition-colors flex items-center justify-between group focus-visible:ring-2 focus-visible:ring-primary">
                  <span className="text-[15px] text-zinc-300 group-hover:text-white">Quiz me on this topic</span>
                  <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-primary transition-colors" />
                </button>
                <button onClick={() => handleSend("Can you give a quick summary?")} className="w-full p-4 rounded-xl border border-white/10 bg-transparent hover:bg-white/5 text-left transition-colors flex items-center justify-between group focus-visible:ring-2 focus-visible:ring-primary">
                  <span className="text-[15px] text-zinc-300 group-hover:text-white">Can you give a quick summary?</span>
                  <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-primary transition-colors" />
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Chat Input */}
      <div className="p-6 bg-gradient-to-t from-[#111111] via-[#111111] to-transparent shrink-0 absolute bottom-0 left-0 right-0 z-10">
        <div className="flex flex-col items-center">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
            className={`w-full relative bg-[#1c1c1c] rounded-2xl flex items-center p-1.5 border border-white/10 focus-within:border-primary/50 transition-colors ${isTyping ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={isTyping}
              placeholder="Ask anything about this lecture..." 
              className="w-full bg-transparent border-none pl-4 py-3 text-[15px] focus:outline-none text-white placeholder:text-zinc-500 disabled:opacity-50" 
            />
            <button 
              type="submit"
              disabled={isTyping || !input.trim()}
              className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors shrink-0 m-1 focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <p className="text-[11px] text-zinc-500 mt-3 text-center">
            AI responses may not always be accurate.<br/>Please use clinical judgment.
          </p>
        </div>
      </div>
    </aside>
  );
}
