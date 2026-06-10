"use client";

import React, { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/store/useStore";
import { Loader2, Power, AlertCircle, MessageSquare } from "lucide-react";

interface LiveMeetingManagerProps {
  sessionId: string;
}

export default function LiveMeetingManager({ sessionId }: LiveMeetingManagerProps) {
  const { addSession, removeLiveMeeting, setCurrentSession } = useStore();
  const [meetingTitle, setMeetingTitle] = useState("Live Google Meet Session");
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [chunks, setChunks] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Fetch meeting details
    const fetchDetails = async () => {
      try {
        const res = await api.get(`/api/v1/meetings/${sessionId}`);
        if (res.data) {
          setMeetingTitle(res.data.title);
        }
      } catch (err) {
        console.error("Failed to fetch meeting details", err);
      }
    };
    fetchDetails();

    // 2. Establish WebSocket connection
    const connectWebSocket = () => {
      if (socketRef.current?.readyState === WebSocket.OPEN || socketRef.current?.readyState === WebSocket.CONNECTING) {
        return;
      }
      setStatus("connecting");
      
      let base = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
      const wsBase = base.replace(/^http/, "ws");
      const wsUrl = `${wsBase}/api/v1/meetings/ws/${sessionId}`;
      
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setStatus("connected");
        setErrorMsg("");
      };

      socket.onmessage = (event) => {
        try {
          const chunk = JSON.parse(event.data);
          if (chunk.type === "system") {
            console.log("WebSocket system message:", chunk.message);
            return;
          }
          setChunks((prev) => [...prev, chunk]);
        } catch (e) {
          console.error("Error parsing WebSocket message:", e);
        }
      };

      socket.onerror = (err) => {
        console.error("WebSocket error:", err);
        setErrorMsg("WebSocket connection error. Retrying...");
      };

      socket.onclose = () => {
        setStatus("disconnected");
        // Try reconnecting in 3 seconds if not unmounted
        if (socketRef.current === socket) {
          setTimeout(connectWebSocket, 3000);
        }
      };

      socketRef.current = socket;
    };

    connectWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [sessionId]);

  // Auto-scroll transcript container
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chunks]);

  const endMeetingAndProcess = async () => {
    // Close WebSocket
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    try {
      await api.post(`/api/v1/meetings/${sessionId}/end`);
      
      // Update store state
      addSession({
        job_id: sessionId,
        source_filename: meetingTitle,
        status: 'processing',
        created_at: new Date().toISOString()
      });
      removeLiveMeeting(sessionId);
      setCurrentSession(sessionId);
    } catch (err) {
      console.error("Failed to end and process meeting", err);
      alert("Failed to end meeting session. Please verify backend logs.");
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto p-4 space-y-6">
      {/* Header Info */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between shadow-2xl gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-400">
            <MessageSquare size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">{meetingTitle}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  status === "connected" ? "bg-green-400" : status === "connecting" ? "bg-yellow-400" : "bg-red-400"
                }`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  status === "connected" ? "bg-green-500" : status === "connecting" ? "bg-yellow-500" : "bg-red-500"
                }`}></span>
              </span>
              <span className="text-zinc-500 text-xs font-medium capitalize">
                Google Meet Caption Sync: {status}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={endMeetingAndProcess}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-6 rounded-2xl transition-all shadow-lg hover:shadow-red-950/20"
        >
          <Power size={18} />
          <span>Stop Session & Process</span>
        </button>
      </div>

      {errorMsg && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 flex items-center gap-3 text-yellow-400 text-sm">
          <AlertCircle size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Live Scrolling Captures */}
      <div className="flex-1 flex flex-col min-h-0 bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="h-12 border-b border-zinc-800 px-6 flex items-center justify-between bg-zinc-900/30">
          <span className="font-semibold text-zinc-300">Live Transcript Feed</span>
          <span className="text-xs text-zinc-500 font-mono">{chunks.length} chunks captured</span>
        </div>

        <div 
          ref={scrollRef} 
          className="flex-1 overflow-y-auto p-6 space-y-4"
        >
          {chunks.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
              <p className="text-zinc-400 text-sm font-medium">Waiting for captions from Google Meet...</p>
              <p className="text-zinc-600 text-xs max-w-xs">
                Ensure you are in a Google Meet, have turned on Closed Captions, and started capture in the DAMAK extension.
              </p>
            </div>
          ) : (
            chunks.map((chunk, index) => (
              <div 
                key={chunk.id || index} 
                className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl hover:border-zinc-700 transition-all flex flex-col"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs uppercase tracking-wider text-orange-400">
                    {chunk.speaker || "Unknown Speaker"}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {chunk.created_at ? new Date(chunk.created_at).toLocaleTimeString() : new Date().toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-zinc-200 leading-relaxed text-[13.5px]">{chunk.text}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
