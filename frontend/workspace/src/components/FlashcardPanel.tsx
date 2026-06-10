"use client";

import React, { useState } from "react";
import { useStore } from "@/store/useStore";
import { Brain, RefreshCw, ChevronRight, ChevronLeft, CheckCircle2, Circle } from "lucide-react";
import { api } from "@/lib/api";

export default function FlashcardPanel() {
  const { currentSessionId, setHighlightedTimestamp } = useStore();
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [flashcardType, setFlashcardType] = useState("qa");

  const generateFlashcards = async () => {
    if (!currentSessionId) return;
    setLoading(true);
    try {
      const res = await api.post("/api/v1/intelligence/flashcards/generate", {
        session_id: currentSessionId,
        count: 5,
        type: flashcardType
      });
      setFlashcards(res.data.flashcards);
      setCurrentIndex(0);
      setShowAnswer(false);
    } catch (err: any) {
      if (err.response?.status === 404) {
        alert("Session processing is not complete yet. Please wait a moment.");
      } else {
        console.error("Flashcard generation failed", err);
      }
    } finally {
      setLoading(false);
    }
  };

  const nextCard = () => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowAnswer(false);
    }
  };

  const prevCard = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowAnswer(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto h-full flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400">
              <Brain size={20} />
           </div>
           <div>
              <h3 className="text-xl font-bold">AI Flashcards</h3>
              <p className="text-zinc-500 text-xs">Test your knowledge from this lecture</p>
           </div>
        </div>
        
        <div className="flex items-center gap-4">
          <select 
            value={flashcardType} 
            onChange={(e) => setFlashcardType(e.target.value)}
            disabled={loading || !currentSessionId}
            className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600 disabled:opacity-50"
          >
            <option value="qa">Q&A</option>
            <option value="mcq">Multiple Choice</option>
            <option value="revision">Revision</option>
          </select>
          
          <button 
            onClick={generateFlashcards}
            disabled={loading || !currentSessionId}
            className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-1.5 rounded-lg text-sm hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            <span>{flashcards.length > 0 ? 'Regenerate' : 'Generate'}</span>
          </button>
        </div>
      </div>

      {flashcards.length > 0 ? (
        <div className="flex-1 flex flex-col justify-center gap-8">
          <div className="text-center text-zinc-500 text-xs font-mono uppercase tracking-widest">
            Card {currentIndex + 1} of {flashcards.length}
          </div>

          <div 
            onClick={() => setShowAnswer(!showAnswer)}
            className={`aspect-[4/3] w-full rounded-3xl p-12 flex flex-col items-center justify-center text-center text-xl cursor-pointer transition-all duration-500 preserve-3d relative ${showAnswer ? 'bg-white text-black' : 'bg-zinc-900 border-2 border-zinc-800 text-white hover:border-zinc-600'}`}
          >
            <div className="leading-relaxed font-medium mb-8">
              {showAnswer ? flashcards[currentIndex].answer : flashcards[currentIndex].question}
            </div>

            {!showAnswer && flashcards[currentIndex].options && flashcards[currentIndex].options.length > 0 && (
              <div className="w-full max-w-sm space-y-2 mt-4 text-left">
                {flashcards[currentIndex].options.map((opt: string, idx: number) => (
                  <div key={idx} className="bg-zinc-800 border border-zinc-700 px-4 py-3 rounded-xl text-sm font-normal">
                    {opt}
                  </div>
                ))}
              </div>
            )}

            {showAnswer && flashcards[currentIndex].timestamp !== undefined && flashcards[currentIndex].timestamp !== null && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setHighlightedTimestamp(flashcards[currentIndex].timestamp);
                }}
                className="mt-6 px-4 py-2 bg-zinc-100 border border-zinc-300 rounded-lg text-sm font-semibold hover:bg-zinc-200 transition-colors flex items-center gap-2 text-black"
              >
                Jump to Source [{Math.floor(flashcards[currentIndex].timestamp / 60)}:{(flashcards[currentIndex].timestamp % 60).toFixed(0).padStart(2, '0')}]
              </button>
            )}

            <div className="absolute bottom-6 text-xs opacity-50 font-normal">
              Click to {showAnswer ? 'see question' : 'flip and see answer'}
            </div>
          </div>

          <div className="flex items-center justify-center gap-4">
             <button 
               onClick={prevCard}
               disabled={currentIndex === 0}
               className="p-3 bg-zinc-900 border border-zinc-800 rounded-full hover:bg-zinc-800 disabled:opacity-20 transition-all"
             >
                <ChevronLeft size={24} />
             </button>
             <button 
               onClick={nextCard}
               disabled={currentIndex === flashcards.length - 1}
               className="p-3 bg-zinc-900 border border-zinc-800 rounded-full hover:bg-zinc-800 disabled:opacity-20 transition-all"
             >
                <ChevronRight size={24} />
             </button>
          </div>
        </div>
      ) : !loading && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
           <Brain size={48} className="text-zinc-800 mb-4" />
           <p className="text-zinc-600">No flashcards generated yet.</p>
           <button 
             onClick={generateFlashcards}
             className="mt-4 text-orange-400 hover:underline text-sm font-medium"
           >
             Click to generate study materials
           </button>
        </div>
      )}

      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
           <div className="w-full aspect-[4/3] bg-zinc-900 animate-pulse rounded-3xl"></div>
           <div className="flex gap-4">
              <div className="w-12 h-12 bg-zinc-900 animate-pulse rounded-full"></div>
              <div className="w-12 h-12 bg-zinc-900 animate-pulse rounded-full"></div>
           </div>
        </div>
      )}
    </div>
  );
}
