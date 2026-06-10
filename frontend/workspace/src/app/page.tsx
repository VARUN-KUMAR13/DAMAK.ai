"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import TranscriptPanel from "@/components/TranscriptPanel";
import TimelinePanel from "@/components/TimelinePanel";
import ChatPanel from "@/components/ChatPanel";
import NotesPanel from "@/components/NotesPanel";
import LiveCaptureManager from "@/components/LiveCaptureManager";
import LiveMeetingManager from "@/components/LiveMeetingManager";
import GlobalOmnibar from "@/components/GlobalOmnibar";
import { useStore } from "@/store/useStore";
import { api } from "@/lib/api";
import { BookOpen, Loader2, Upload } from "lucide-react";

export default function Workspace() {
  const { 
    currentSessionId, setCurrentSession, 
    currentLiveSessionId, setCurrentLiveSession,
    currentLiveMeetingId, setCurrentLiveMeeting,
    uploadingFile,
    sessions, setSessions, removeSession, 
    liveSessions, removeLiveSession,
    liveMeetings, removeLiveMeeting,
    setTranscript, setScreenshots,
    addSession 
  } = useStore();
  const [activeTab, setActiveTab] = useState<"notes" | "chat">("notes");
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
          // Update the session in the store so UI stops showing "processing"
          setSessions(useStore.getState().sessions.map((s: any) => 
            (s.job_id || s.id) === currentSessionId ? { ...s, status: 'completed' } : s
          ));
          if (pollInterval) clearInterval(pollInterval);
        }
      }, 5000);

    } else if (currentLiveSessionId) {
      fetchLiveSessionData(currentLiveSessionId);
    } else if (currentLiveMeetingId) {
      fetchLiveMeetingData(currentLiveMeetingId);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [currentSessionId, currentLiveSessionId, currentLiveMeetingId]);

  const fetchLiveMeetingData = async (id: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/v1/meetings/${id}`);
      setTranscript([]);
      setScreenshots([]);
      console.log("Active Live Meeting:", res.data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        console.warn(`Live Meeting ${id} no longer exists. Clearing.`);
        setCurrentLiveMeeting(null);
        removeLiveMeeting(id);
      } else {
        console.error("Failed to fetch live meeting data", err);
      }
    } finally {
      setLoading(false);
    }
  };

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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    useStore.getState().setUploadingFile(file.name);
    setCurrentSession(null);
    setCurrentLiveSession(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/api/v1/jobs", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      
      const newJob = {
        job_id: res.data.job_id,
        source_filename: file.name,
        status: res.data.status,
      };

      addSession(newJob);
      setCurrentSession(newJob.job_id);
    } catch (err) {
      console.error("Failed to upload file:", err);
      alert("Failed to upload file. Please check file size and format.");
    } finally {
      useStore.getState().setUploadingFile(null);
    }
  };

  const currentJob = sessions.find(s => (s.job_id || s.id) === currentSessionId);
  const currentLive = liveSessions.find(s => (s.session_id || s.id) === currentLiveSessionId);
  const currentMeeting = liveMeetings.find(m => (m.session_id || m.id) === currentLiveMeetingId);
  const activeSessionTitle = currentJob?.source_filename || currentLive?.title || currentMeeting?.title || "Knowledge Workspace";

  return (
    <div className="flex h-screen bg-background overflow-hidden text-sm">
      <GlobalOmnibar />
      
      {/* Sidebar - Sessions */}
      <Sidebar />

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col overflow-hidden border-x border-zinc-800">
        {!currentSessionId && !currentLiveSessionId && !currentLiveMeetingId ? (
          uploadingFile ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
               <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mb-6">
                  <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
               </div>
               <h2 className="text-xl font-semibold text-zinc-300 mb-2">Uploading Media</h2>
               <p className="text-zinc-500 max-w-sm">
                  <span className="text-zinc-300 font-medium">{uploadingFile}</span> is being uploaded to your local DAMAK AI server.
               </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
               <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-6 border border-zinc-800">
                  <BookOpen className="text-zinc-500 w-8 h-8" />
               </div>
               <h2 className="text-xl font-semibold text-zinc-300 mb-2">Welcome to DAMAK AI</h2>
               <p className="text-zinc-500 max-w-sm mb-8">
                  Select a lecture from the sidebar, create a new live session, or upload a pre-recorded video to get started.
               </p>
               <div className="flex gap-4">
                 <label className="cursor-pointer bg-white text-black px-6 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-zinc-200 transition-colors">
                    <Upload size={18} />
                    <span>Upload Video or Audio</span>
                    <input type="file" hidden accept="video/*,audio/*" onChange={handleUpload} />
                 </label>
               </div>
            </div>
          )
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
              </div>
            </header>

            {/* Content Area */}
            <div className={`flex-1 flex overflow-hidden ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
              {/* Left: Visual Context */}
              {!currentLiveMeetingId && (
                <div className="w-1/3 flex flex-col border-r border-zinc-800">
                   <TimelinePanel />
                   <TranscriptPanel />
                </div>
              )}

              {/* Right: Intelligence Panel */}
              <div className="flex-1 overflow-y-auto p-6">
                {currentLiveSessionId ? (
                   <LiveCaptureManager sessionId={currentLiveSessionId} currentLive={currentLive} />
                ) : currentLiveMeetingId ? (
                   <LiveMeetingManager sessionId={currentLiveMeetingId} />
                ) : currentJob?.status === 'failed' ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                     <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center">
                        <span className="text-red-500 font-bold text-3xl">!</span>
                     </div>
                     <h3 className="text-xl font-bold text-red-500">Processing Failed</h3>
                     <p className="text-zinc-400 max-w-sm">
                        {currentJob?.error_message || "An unknown error occurred during processing."}
                     </p>
                  </div>
                ) : currentJob?.status === 'pending' ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                     <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center">
                        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                     </div>
                     <h3 className="text-xl font-bold text-blue-400">READY TO PROCESS</h3>
                     <p className="text-zinc-500 max-w-xs">
                        The file has been uploaded successfully and is currently queued for background processing.
                     </p>
                  </div>
                ) : currentJob?.status !== 'completed' ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                     <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center">
                        <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
                     </div>
                     <h3 className="text-xl font-bold text-yellow-500">Session Processing</h3>
                     <p className="text-zinc-300 font-medium text-lg mt-2">
                        {currentJob?.progress_stage || "Initializing multimodal pipeline..."}
                     </p>
                     <p className="text-zinc-500 max-w-xs mt-2">
                        We are extracting slides, transcribing audio, and generating semantic chunks.
                     </p>
                     <p className="text-zinc-600 text-xs italic mt-4">
                        This usually takes a few minutes depending on lecture length.
                     </p>
                  </div>
                ) : (
                  <>
                    {activeTab === 'notes' && <NotesPanel />}
                    {activeTab === 'chat' && <ChatPanel />}
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
