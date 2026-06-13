"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { BookOpen, History, Plus, Loader2, Upload } from "lucide-react";
import { api } from "@/lib/api";

export default function Sidebar() {
  const { 
    currentSessionId, setCurrentSession, 
    currentLiveSessionId, setCurrentLiveSession,
    uploadingFile, setUploadingFile,
    sessions, setSessions, addSession,
    liveSessions, setLiveSessions, addLiveSession
  } = useStore();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [jobsRes, liveRes] = await Promise.all([
        api.get("/api/v1/jobs"),
        api.get("/api/v1/live/sessions")
      ]);
      setSessions(jobsRes.data);
      setLiveSessions(liveRes.data);
    } catch (err) {
      console.error("Failed to fetch sidebar data", err);
    } finally {
      setLoading(false);
    }
  };

  const createSession = async () => {
    setCreating(true);
    try {
      const title = `Learning Session ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const res = await api.post("/api/v1/live/start", { title, platform: "Meet" });
      
      const newLiveSession = {
        session_id: res.data.session_id,
        title: res.data.title,
        status: res.data.status,
      };

      addLiveSession(newLiveSession);
      setCurrentLiveSession(newLiveSession.session_id);
      console.log("Live Session created successfully:", newLiveSession.session_id);
    } catch (err) {
      console.error("Failed to create session:", err);
      alert("Failed to create session. Please check if backend is running.");
    } finally {
      setCreating(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadingFile(file.name);
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
      setUploading(false);
      setUploadingFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-500';
      case 'pending': return 'bg-blue-500/20 text-blue-500';
      case 'processing': return 'bg-yellow-500/20 text-yellow-500';
      case 'failed': return 'bg-red-500/20 text-red-500';
      default: return 'bg-zinc-500/20 text-zinc-500';
    }
  };

  return (
    <aside className="w-64 flex flex-col bg-zinc-950 border-r border-zinc-800 p-4">
      <div className="flex items-center gap-2 mb-8 px-2">
        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
          <BookOpen className="text-black w-5 h-5" />
        </div>
        <h1 className="font-bold text-lg">DAMAK AI</h1>
      </div>

      <div className="flex gap-2 mb-6">
        <button 
          onClick={createSession}
          disabled={creating || uploading}
          className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 transition-colors rounded-lg p-2.5 text-zinc-400 disabled:opacity-50"
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          <span className="text-xs font-medium">New Live</span>
        </button>

        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={creating || uploading}
          className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 transition-colors rounded-lg p-2.5 text-zinc-400 disabled:opacity-50"
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          <span className="text-xs font-medium">Upload</span>
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          hidden 
          accept="video/*,audio/*" 
          onChange={handleUpload} 
        />
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-6">
        {/* Active Live Sessions */}
        {liveSessions.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-orange-500 uppercase tracking-wider mb-2 px-2 flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              Live Capturing
            </div>
            <div className="space-y-1">
              {liveSessions.map((s) => (
                <button
                  key={s.session_id}
                  onClick={() => setCurrentLiveSession(s.session_id)}
                  className={`w-full text-left p-3 rounded-lg transition-all group ${
                    currentLiveSessionId === s.session_id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900'
                  }`}
                >
                  <div className="font-medium truncate">{s.title}</div>
                  <div className="text-[10px] opacity-50">CAPTURE ACTIVE</div>
                </button>
              ))}
            </div>
          </div>
        )}



        {/* Processed Jobs */}
        <div>
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-2 flex items-center gap-2">
            <History size={14} />
            Recent Lectures
          </div>
          <div className="space-y-1">
            {loading ? (
              <div className="px-2 text-zinc-600 text-xs italic">Loading...</div>
            ) : sessions.length === 0 && liveSessions.length === 0 ? (
              <div className="px-2 text-zinc-600 text-xs italic">No sessions found.</div>
            ) : (
              sessions.map((s) => (
                <button
                  key={s.job_id}
                  onClick={() => setCurrentSession(s.job_id)}
                  className={`w-full text-left p-3 rounded-lg transition-all group ${
                    currentSessionId === s.job_id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900'
                  }`}
                >
                  <div className="font-medium truncate text-[13px]">{s.source_filename}</div>
                  <div className="flex items-center justify-between gap-2 mt-1.5">
                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${getStatusColor(s.status)}`}>
                      {s.status}
                    </span>
                    {s.created_at && (
                      <span className="text-[10px] opacity-50 whitespace-nowrap truncate">
                        {new Date(s.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
