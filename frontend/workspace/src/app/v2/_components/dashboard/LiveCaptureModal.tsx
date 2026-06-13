"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Loader2, AlertCircle, CheckCircle2, PlayCircle, X } from "lucide-react";
import { useLiveStore } from "../../../../store/live.store";
import { useRouter } from "next/navigation";

export function LiveCaptureModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  
  const { 
    activeSession, 
    captureState, 
    error, 
    elapsedSeconds,
    chunkQueue,
    startSession, 
    stopSession, 
    enqueueChunk,
    incrementTimer,
    reset
  } = useLiveStore();

  const router = useRouter();

  // MediaRecorder Refs
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioStream = useRef<MediaStream | null>(null);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);

  // Format Timer
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Timer
  useEffect(() => {
    if (captureState === "recording") {
      timerInterval.current = setInterval(() => incrementTimer(), 1000);
    } else if (timerInterval.current) {
      clearInterval(timerInterval.current);
    }
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, [captureState, incrementTimer]);

  // Start Recording Logic
  const handleStart = async () => {
    if (!title.trim()) return;
    setMicError(null);

    try {
      // 1. Get Mic Permission First
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStream.current = stream;
      
      // 2. Init API Session
      await startSession(title);

      // 3. Start MediaRecorder (5s chunks)
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorder.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          // File constructor is better for formData
          const file = new File([e.data], `chunk_${Date.now()}.webm`, { type: 'audio/webm' });
          enqueueChunk({ file, type: 'audio' });
        }
      };

      recorder.start(5000); // chunk every 5s

    } catch (err: any) {
      setMicError(err.message || "Microphone permission denied.");
    }
  };

  // Stop Recording Logic
  const handleStop = async () => {
    if (mediaRecorder.current && mediaRecorder.current.state === "recording") {
      mediaRecorder.current.stop();
    }
    if (audioStream.current) {
      audioStream.current.getTracks().forEach(track => track.stop());
    }
    await stopSession();
  };

  // Navigate on complete
  useEffect(() => {
    if (captureState === "completed" && activeSession) {
      setTimeout(() => {
        onClose();
        reset();
        router.push(`/v2/study/${activeSession.session_id}`);
      }, 2000);
    }
  }, [captureState, activeSession, router, onClose, reset]);

  if (!isOpen && captureState === "idle") return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-[#141414] border border-white/10 shadow-2xl rounded-2xl w-full max-w-md overflow-hidden relative"
        >
          {/* Close Button if idle or error */}
          {(captureState === "idle" || captureState === "failed") && (
             <button onClick={() => { reset(); onClose(); }} className="absolute top-4 right-4 text-zinc-400 hover:text-white">
               <X className="w-5 h-5" />
             </button>
          )}

          <div className="p-8 flex flex-col items-center">
            
            {/* STATE: IDLE */}
            {(captureState === "idle" || captureState === "starting") && (
              <>
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-6 text-primary">
                  <Mic className="w-8 h-8" />
                </div>
                <h2 className="font-display text-2xl font-bold text-white mb-2">New Live Session</h2>
                <p className="text-sm text-zinc-400 text-center mb-6">Capture a live lecture, and the AI Mentor will generate notes in real-time.</p>
                
                {micError && (
                  <div className="w-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg flex items-center gap-2 mb-4">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {micError}
                  </div>
                )}
                {error && (
                  <div className="w-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg flex items-center gap-2 mb-4">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                <input 
                  type="text" 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Distributed Systems 101" 
                  disabled={captureState === "starting"}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary mb-6 disabled:opacity-50"
                  autoFocus
                />
                
                <button 
                  onClick={handleStart}
                  disabled={!title.trim() || captureState === "starting"}
                  className="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {captureState === "starting" ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
                  {captureState === "starting" ? "Connecting..." : "Start Recording"}
                </button>
              </>
            )}

            {/* STATE: RECORDING */}
            {captureState === "recording" && (
              <>
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-red-500 rounded-full blur-xl opacity-30 animate-pulse"></div>
                  <div className="w-24 h-24 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-500 relative z-10">
                    <Mic className="w-10 h-10 animate-pulse" />
                  </div>
                </div>
                
                <div className="font-display text-4xl font-light text-white tracking-widest mb-2">
                  {formatTime(elapsedSeconds)}
                </div>
                <h3 className="text-zinc-400 font-medium mb-8 line-clamp-1">{activeSession?.title}</h3>

                <div className="w-full flex justify-between items-center bg-white/5 border border-white/10 rounded-xl p-4 mb-8">
                  <div className="flex flex-col">
                    <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Sync Status</span>
                    <span className="text-sm text-emerald-400 font-medium flex items-center gap-1">
                      {chunkQueue.length > 0 ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      {chunkQueue.length > 0 ? `Uploading (${chunkQueue.length} queued)` : 'Synced securely'}
                    </span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                </div>

                <button 
                  onClick={handleStop}
                  className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Square className="w-5 h-5 fill-current" />
                  Stop & Process Session
                </button>
              </>
            )}

            {/* STATE: STOPPING / PROCESSING */}
            {(captureState === "stopping" || captureState === "processing") && (
              <div className="flex flex-col items-center py-8 w-full">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-6" />
                <h2 className="font-display text-xl font-bold text-white mb-2">Processing Lecture</h2>
                
                <div className="w-full bg-white/5 rounded-xl p-4 mt-4 border border-white/10 text-sm text-zinc-400 space-y-2">
                  <div className="flex justify-between">
                    <span>Flushing audio chunks...</span>
                    <span className={captureState === "stopping" ? "text-primary animate-pulse" : "text-emerald-400"}>
                      {captureState === "stopping" ? "In Progress" : "Done"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Generating AI Notes...</span>
                    <span className={captureState === "processing" ? "text-primary animate-pulse" : "text-zinc-500"}>
                      {captureState === "processing" ? "In Progress" : "Waiting"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* STATE: COMPLETED */}
            {captureState === "completed" && (
              <div className="flex flex-col items-center py-8">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="font-display text-2xl font-bold text-white mb-2">Ready to Study</h2>
                <p className="text-zinc-400 text-center text-sm">Navigating to your personalized workspace...</p>
              </div>
            )}
            
            {/* STATE: FAILED */}
            {captureState === "failed" && (
              <div className="flex flex-col items-center py-8">
                <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mb-6">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h2 className="font-display text-2xl font-bold text-white mb-2">Processing Failed</h2>
                <p className="text-red-400 text-center text-sm mb-6 max-w-sm">{error || "An unknown error occurred during processing."}</p>
                <button onClick={() => reset()} className="px-6 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-white font-medium">Dismiss</button>
              </div>
            )}

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
