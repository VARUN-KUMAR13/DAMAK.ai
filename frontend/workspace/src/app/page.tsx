"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import TranscriptPanel from "@/components/TranscriptPanel";
import TimelinePanel from "@/components/TimelinePanel";
import ChatPanel from "@/components/ChatPanel";
import NotesPanel from "@/components/NotesPanel";
import FlashcardPanel from "@/components/FlashcardPanel";
import { useStore } from "@/store/useStore";
import { api } from "@/lib/api";
import { BookOpen, Loader2 } from "lucide-react";

export default function Workspace() {
  const { 
    currentSessionId, setCurrentSession, 
    currentLiveSessionId, setCurrentLiveSession,
    sessions, removeSession, 
    liveSessions, removeLiveSession,
    setTranscript, setScreenshots,
    addSession 
  } = useStore();
  const [activeTab, setActiveTab] = useState<"notes" | "chat" | "flashcards">("notes");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;

    if (currentSessionId) {
      fetchJobData(currentSessionId);
      
      // If the session is still processing, start polling
      pollInterval = setInterval(async () => {
        const res = await api.get(`/api/v1/jobs/${currentSessionId}`);
        if (res.data.status === 'completed') {
          fetchJobData(currentSessionId);
          if (pollInterval) clearInterval(pollInterval);
        }
      }, 5000);

    } else if (currentLiveSessionId) {
      fetchLiveSessionData(currentLiveSessionId);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [currentSessionId, currentLiveSessionId]);

  const fetchJobData = async (id: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/v1/jobs/${id}`);
      if (res.data.transcript) {
        setTranscript(res.data.transcript.segments);
      }
      setScreenshots(res.data.ocr_results || []);
    } catch (err: any) {
      if (err.response?.status === 404) {
        console.warn(`Job ${id} no longer exists. Clearing stale session.`);
        setCurrentSession(null);
        removeSession(id);
      } else {
        console.error("Failed to fetch job data", err);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveSessionData = async (id: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/v1/live/${id}`);
      // Live sessions might not have transcripts/screenshots yet
      // but we can show status
      setTranscript([]);
      setScreenshots([]);
      console.log("Active Live Session:", res.data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        console.warn(`Live Session ${id} no longer exists. Clearing.`);
        setCurrentLiveSession(null);
        removeLiveSession(id);
      } else {
        console.error("Failed to fetch live session data", err);
      }
    } finally {
      setLoading(false);
    }
  };

  const currentJob = sessions.find(s => (s.job_id || s.id) === currentSessionId);
  const currentLive = liveSessions.find(s => (s.session_id || s.id) === currentLiveSessionId);
  const activeSessionTitle = currentJob?.source_filename || currentLive?.title || "Knowledge Workspace";

  return (
    <div className="flex h-screen bg-background overflow-hidden text-sm">
      {/* Sidebar - Sessions */}
      <Sidebar />

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col overflow-hidden border-x border-zinc-800">
        {!currentSessionId && !currentLiveSessionId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
             <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-6 border border-zinc-800">
                <BookOpen className="text-zinc-500 w-8 h-8" />
             </div>
             <h2 className="text-xl font-semibold text-zinc-300 mb-2">No active session selected</h2>
             <p className="text-zinc-500 max-w-sm">
                Select a lecture from the sidebar or click "+ New Session" to start capturing.
             </p>
          </div>
        ) : (
          <>
            {/* Top Header */}
            <header className="h-14 border-b border-zinc-800 flex items-center px-6 justify-between">
              <div className="flex items-center gap-3 truncate">
                {currentLiveSessionId && (
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse flex-shrink-0" />
                )}
                <h2 className="font-semibold text-lg truncate">
                  {activeSessionTitle}
                </h2>
              </div>
              <div className="flex gap-2">
                 <button 
                   onClick={() => setActiveTab('notes')}
                   className={`px-4 py-1.5 rounded-full transition-colors ${activeTab === 'notes' ? 'bg-white text-black' : 'hover:bg-zinc-800'}`}
                 >Notes</button>
                 <button 
                   onClick={() => setActiveTab('chat')}
                   className={`px-4 py-1.5 rounded-full transition-colors ${activeTab === 'chat' ? 'bg-white text-black' : 'hover:bg-zinc-800'}`}
                 >AI Tutor</button>
                 <button 
                   onClick={() => setActiveTab('flashcards')}
                   className={`px-4 py-1.5 rounded-full transition-colors ${activeTab === 'flashcards' ? 'bg-white text-black' : 'hover:bg-zinc-800'}`}
                 >Flashcards</button>
              </div>
            </header>

            {/* Content Area */}
            <div className={`flex-1 flex overflow-hidden ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
              {/* Left: Visual Context */}
              <div className="w-1/3 flex flex-col border-r border-zinc-800">
                 <TimelinePanel />
                 <TranscriptPanel />
              </div>

              {/* Right: Intelligence Panel */}
              <div className="flex-1 overflow-y-auto p-6">
                {currentLiveSessionId ? (
                   <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                      <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center">
                         <div className="w-10 h-10 bg-orange-500 rounded-full animate-ping opacity-20" />
                         <div className="w-4 h-4 bg-orange-500 rounded-full absolute" />
                      </div>
                      <h3 className="text-xl font-bold">Capture in Progress</h3>
                      <p className="text-zinc-500 max-w-xs">
                         This session is currently being captured via the Chrome extension. 
                         Intelligence features will be available once you stop the capture.
                      </p>
                      <button 
                        onClick={async () => {
                          try {
                            const res = await api.post(`/api/v1/live/${currentLiveSessionId}/stop`);
                            // Switch to job view and set as processing
                            const jobId = res.data.session_id;
                            addSession({
                              job_id: jobId,
                              source_filename: res.data.title,
                              status: 'processing'
                            });
                            removeLiveSession(currentLiveSessionId);
                            setCurrentSession(jobId);
                          } catch (err) {
                            console.error("Failed to stop session", err);
                            alert("Failed to stop session. Please check backend logs.");
                          }
                        }}
                        className="bg-zinc-900 border border-zinc-800 px-6 py-2 rounded-xl hover:bg-zinc-800 transition-all font-medium"
                      >
                        Stop Capture & Process
                      </button>
                   </div>
                ) : currentJob?.status !== 'completed' ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                     <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center">
                        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                     </div>
                     <h3 className="text-xl font-bold">Session Processing</h3>
                     <p className="text-zinc-500 max-w-xs">
                        We are currently transcribing, extracting slides, and generating semantic chunks.
                        Status: <span className="text-blue-400 uppercase font-mono">{currentJob?.status || 'pending'}</span>
                     </p>
                     <p className="text-zinc-600 text-xs italic">
                        This usually takes a few minutes depending on lecture length.
                     </p>
                  </div>
                ) : (
                  <>
                    {activeTab === 'notes' && <NotesPanel />}
                    {activeTab === 'chat' && <ChatPanel />}
                    {activeTab === 'flashcards' && <FlashcardPanel />}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
