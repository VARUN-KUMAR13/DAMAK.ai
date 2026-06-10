"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import GlobalOmnibar from "@/components/GlobalOmnibar";
import { api } from "@/lib/api";
import { Loader2, BrainCircuit, CalendarCheck, Target, CheckCircle2, RefreshCcw } from "lucide-react";

export default function StudyDashboard() {
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<any>(null);
  const [activeCard, setActiveCard] = useState<any>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/v1/study/queue");
      setQueue(res.data);
    } catch (err) {
      console.error("Failed to fetch study queue", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleStartReview = () => {
    if (!queue) return;
    if (queue.review_cards.length > 0) setActiveCard(queue.review_cards[0]);
    else if (queue.learning_cards.length > 0) setActiveCard(queue.learning_cards[0]);
    else if (queue.new_cards.length > 0) setActiveCard(queue.new_cards[0]);
  };

  const submitReview = async (rating: number) => {
    if (!activeCard) return;
    try {
      await api.post(`/api/v1/study/review/${activeCard.id}`, { rating });
      setShowAnswer(false);
      setActiveCard(null);
      await fetchQueue();
      handleStartReview(); // pull next card
    } catch (err) {
      console.error("Failed to submit review", err);
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden text-sm">
      <GlobalOmnibar />
      <Sidebar />
      <main className="flex-1 flex flex-col items-center p-6 overflow-y-auto border-x border-zinc-800">
        <header className="w-full max-w-4xl flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BrainCircuit className="text-blue-500 w-8 h-8" />
            Study Center
          </h1>
          {queue && (
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className="text-blue-400 font-bold text-xl">{queue.new_cards.length}</span>
                <span className="text-zinc-500 text-xs uppercase tracking-wider">New</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-orange-400 font-bold text-xl">{queue.learning_cards.length}</span>
                <span className="text-zinc-500 text-xs uppercase tracking-wider">Learn</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-green-500 font-bold text-xl">{queue.review_cards.length}</span>
                <span className="text-zinc-500 text-xs uppercase tracking-wider">Review</span>
              </div>
            </div>
          )}
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-zinc-600 animate-spin" />
          </div>
        ) : !activeCard ? (
          <div className="flex-1 flex flex-col items-center justify-center max-w-md text-center">
            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">You're all caught up!</h2>
            <p className="text-zinc-400 mb-8">
              There are no pending flashcards in your daily queue. 
              Upload a new lecture or come back tomorrow.
            </p>
            {queue && queue.total_due > 0 && (
               <button onClick={handleStartReview} className="bg-white text-black px-6 py-3 rounded-xl font-bold hover:bg-zinc-200 transition-colors flex items-center gap-2">
                 <RefreshCcw size={18} />
                 Start Review Session
               </button>
            )}
          </div>
        ) : (
          <div className="flex-1 w-full max-w-3xl flex flex-col items-center justify-center pb-20">
            {/* Flashcard Component */}
            <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl min-h-[300px] flex flex-col">
              <div className="flex justify-between items-start mb-6">
                 <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                   {activeCard.state === 0 ? "New Card" : activeCard.state === 1 ? "Learning" : "Review"}
                 </span>
                 <span className="text-xs font-mono text-zinc-600">ID: {activeCard.flashcard_id.slice(0,8)}</span>
              </div>
              
              <div className="flex-1 flex items-center justify-center text-center">
                <h2 className="text-2xl font-medium text-white">
                  {activeCard.content?.question || "Question content missing"}
                </h2>
              </div>

              {!showAnswer ? (
                <div className="mt-8 pt-6 border-t border-zinc-800/50 flex justify-center">
                  <button onClick={() => setShowAnswer(true)} className="bg-zinc-800 text-white px-8 py-3 rounded-xl font-medium hover:bg-zinc-700 transition-colors w-full max-w-sm">
                    Show Answer
                  </button>
                </div>
              ) : (
                <div className="mt-8 pt-6 border-t border-zinc-800/50 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="text-lg text-zinc-300 text-center mb-8 bg-zinc-950 p-6 rounded-xl w-full border border-zinc-800/50">
                    {activeCard.content?.answer || "Answer content missing"}
                  </div>
                  
                  <div className="w-full flex justify-between gap-4">
                    <button onClick={() => submitReview(1)} className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl font-bold transition-colors">
                      <div className="text-sm">Again</div>
                      <div className="text-xs font-normal opacity-70">&lt; 1 min</div>
                    </button>
                    <button onClick={() => submitReview(2)} className="flex-1 py-3 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-xl font-bold transition-colors">
                      <div className="text-sm">Hard</div>
                      <div className="text-xs font-normal opacity-70">~ 5 mins</div>
                    </button>
                    <button onClick={() => submitReview(3)} className="flex-1 py-3 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-xl font-bold transition-colors">
                      <div className="text-sm">Good</div>
                      <div className="text-xs font-normal opacity-70">~ 10 mins</div>
                    </button>
                    <button onClick={() => submitReview(4)} className="flex-1 py-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl font-bold transition-colors">
                      <div className="text-sm">Easy</div>
                      <div className="text-xs font-normal opacity-70">~ 4 days</div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
