"use client";

import React, { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import { BookOpen, History, Plus, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

export default function Sidebar() {
  const { 
    currentSessionId, setCurrentSession, 
    currentLiveSessionId, setCurrentLiveSession,
    sessions, setSessions, addSession,
    liveSessions, setLiveSessions, addLiveSession
  } = useStore();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

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
      const res = await api.post("/api/v1/live/start", { title });
      
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

  return (
    <aside className="w-64 flex flex-col bg-zinc-950 border-r border-zinc-800 p-4">
      <div className="flex items-center gap-2 mb-8 px-2">
        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
          <BookOpen className="text-black w-5 h-5" />
        </div>
        <h1 className="font-bold text-lg">DAMAK AI</h1>
      </div>

      <button 
        onClick={createSession}
        disabled={creating}
        className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 transition-colors rounded-lg p-2.5 mb-6 text-zinc-400 disabled:opacity-50"
      >
        {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
        <span>New Session</span>
      </button>

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
                  <div className="font-medium truncate">{s.source_filename}</div>
                  <div className="text-[10px] opacity-50 uppercase">{s.status}</div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
