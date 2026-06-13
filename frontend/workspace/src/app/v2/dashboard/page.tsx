"use client";

import { useEffect, useRef, useState } from "react";
import { DashboardHeader } from "../_components/dashboard/DashboardHeader";
import { DashboardStats } from "../_components/dashboard/DashboardStats";
import { UploadZone } from "../_components/dashboard/UploadZone";
import { SessionCard } from "../_components/dashboard/SessionCard";
import { LiveCaptureModal } from "../_components/dashboard/LiveCaptureModal";
import { useSessionsStore } from "../../../store/sessions.store";
import { PlusCircle } from "lucide-react";
import Link from "next/link";

export default function V2DashboardPage() {
  const { sessions, isLoading, fetchSessions } = useSessionsStore();
  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  const [isLiveModalOpen, setIsLiveModalOpen] = useState(false);

  useEffect(() => {
    // Initial fetch
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    // Polling Logic
    const hasProcessingJobs = sessions.some(s => s.status === "pending" || s.status === "processing");
    
    if (hasProcessingJobs) {
      if (!pollInterval.current) {
        pollInterval.current = setInterval(() => {
          fetchSessions();
        }, 3000);
      }
    } else {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
        pollInterval.current = null;
      }
    }

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
        pollInterval.current = null;
      }
    };
  }, [sessions, fetchSessions]);

  const pendingReviewsCount = sessions.filter(s => s.status === "completed").length; // Mocking "Reviews" as completed for now

  return (
    <div className="flex-1 p-4 md:p-10 lg:p-16 overflow-y-auto custom-scrollbar">
      <DashboardHeader userName="Varun" pendingReviewsCount={pendingReviewsCount} />

      {/* AI Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
        <div className="lg:col-span-2">
          <DashboardStats 
            sessions={sessions}
            isLoading={isLoading && sessions.length === 0}
          />
        </div>
        <div>
          <UploadZone />
        </div>
      </div>

      <h2 className="font-display text-xl font-semibold text-white mb-6">Learning Sessions</h2>
      
      {/* Sessions Grid */}
      {isLoading && sessions.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
          {[1, 2, 3].map(i => <SessionCard key={i} isLoading={true} />)}
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white/5 border border-white/10 rounded-2xl">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">📚</span>
          </div>
          <h3 className="font-display text-lg text-white mb-2">No learning sessions yet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
            Upload your first lecture video above, or start a live capture to let the AI Tutor generate notes and a personalized study plan.
          </p>
          <div className="flex gap-4">
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-lg font-medium transition-colors text-sm">
              Upload Video
            </button>
            <button onClick={() => setIsLiveModalOpen(true)} className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors text-sm flex items-center gap-2">
              <PlusCircle className="w-4 h-4" /> Start Live Session
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
          {sessions.map(session => (
            <SessionCard key={session.job_id} session={session} />
          ))}
        </div>
      )}
      
      <LiveCaptureModal isOpen={isLiveModalOpen} onClose={() => setIsLiveModalOpen(false)} />
    </div>
  );
}
