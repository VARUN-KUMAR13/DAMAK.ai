"use client";

import React, { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/store/useStore";

interface LiveCaptureManagerProps {
  sessionId: string;
  currentLive: any;
}

export default function LiveCaptureManager({ sessionId, currentLive }: LiveCaptureManagerProps) {
  const { addSession, removeLiveSession, setCurrentSession } = useStore();
  const [isCapturing, setIsCapturing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [stats, setStats] = useState({ audioChunks: 0, screenshots: 0 });

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenshotIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    // Start polling the backend for stats
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/api/v1/live/${sessionId}`);
        if (res.data) {
          setStats({
            audioChunks: res.data.audio_chunks_count || 0,
            screenshots: res.data.screenshot_count || 0
          });
        }
      } catch (err) {
        console.error("Failed to fetch live stats", err);
      }
    }, 5000);

    return () => {
      stopCaptureInternal();
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [sessionId]);

  const startCapture = async () => {
    try {
      setErrorMsg("");
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true // Important for Whisper
      });

      // Check if audio track exists
      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach(t => t.stop());
        setErrorMsg("No audio track detected. Please make sure to check 'Share tab audio' in the prompt.");
        return;
      }

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      startTimeRef.current = Date.now();

      // Extract only audio tracks for the audio recorder
      const audioStream = new MediaStream(stream.getAudioTracks());

      // Setup Audio Recorder
      // Let the browser choose the best supported audio codec by omitting strict mimeType or using a broader one
      let options = {};
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          options = { mimeType: "audio/webm;codecs=opus" };
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          options = { mimeType: "audio/webm" };
      }
      
      const recorder = new MediaRecorder(audioStream, options);
      recorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          const formData = new FormData();
          formData.append("file", new File([e.data], "chunk.webm", { type: "audio/webm" }));
          try {
            await api.post(`/api/v1/live/${sessionId}/upload-audio`, formData);
          } catch (err: any) {
            console.error("Audio upload failed", err);
            if (err.response?.status === 404) {
              setErrorMsg("Live session was lost or ended on the server. Please start a new one.");
              stopCaptureInternal();
            }
          }
        }
      };
      recorder.start(5000); // 5 second chunks
      mediaRecorderRef.current = recorder;

      // Setup Screenshot Interval
      screenshotIntervalRef.current = setInterval(() => {
        captureAndUploadScreenshot();
      }, 5000);

      setIsCapturing(true);

      // Listen for the user clicking the native "Stop sharing" button
      stream.getVideoTracks()[0].onended = () => {
        stopCaptureInternal();
      };
    } catch (err: any) {
      console.error("Error accessing display media.", err);
      if (err.name === 'NotAllowedError') {
        setErrorMsg("Permission to share screen was denied. Please try again and approve the prompt.");
      } else {
        setErrorMsg("Failed to access screen/audio. " + err.message);
      }
    }
  };

  const captureAndUploadScreenshot = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Ensure video has loaded data
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(async (blob) => {
        if (blob) {
          const timestamp = (Date.now() - startTimeRef.current) / 1000.0;
          const formData = new FormData();
          formData.append("file", new File([blob], "screenshot.jpg", { type: "image/jpeg" }));
          formData.append("timestamp", timestamp.toString());
          try {
            await api.post(`/api/v1/live/${sessionId}/upload-screenshot`, formData);
          } catch (err: any) {
            console.error("Screenshot upload failed", err);
            if (err.response?.status === 404) {
              setErrorMsg("Live session was lost or ended on the server. Please start a new one.");
              stopCaptureInternal();
            }
          }
        }
      }, "image/jpeg", 0.7);
    }
  };

  const stopCaptureInternal = () => {
    setIsCapturing(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (screenshotIntervalRef.current) {
      clearInterval(screenshotIntervalRef.current);
      screenshotIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const stopAndProcess = async () => {
    stopCaptureInternal();
    try {
      const title = currentLive?.title || "Live Meeting";
      await api.post(`/api/v1/live/${sessionId}/stop`);
      
      const jobId = sessionId;
      addSession({
        job_id: jobId,
        source_filename: title,
        status: 'processing'
      });
      removeLiveSession(sessionId);
      setCurrentSession(jobId);
    } catch (err) {
      console.error("Failed to stop session", err);
      alert("Failed to stop session. Please check backend logs.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
      <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center">
        <div className={`w-10 h-10 bg-orange-500 rounded-full ${isCapturing ? 'animate-ping opacity-20' : ''}`} />
        <div className="w-4 h-4 bg-orange-500 rounded-full absolute" />
      </div>
      
      <h3 className="text-xl font-bold">Multimodal Live Capture</h3>
      
      {!isCapturing ? (
        <div className="max-w-md space-y-4">
          <p className="text-zinc-400">
            Click the button below to start capturing. When prompted, select the tab you want to record and <strong>ensure "Share tab audio" is enabled</strong>.
          </p>
          {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}
          <button 
            onClick={startCapture}
            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-6 rounded-xl transition-colors"
          >
            Start Screen & Audio Capture
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-zinc-300 font-medium text-lg">
            Live Session Active - Transcribing in background...
          </p>
          <div className="flex justify-center gap-8 text-sm">
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
              <div className="text-zinc-500 font-semibold mb-1">Audio Chunks</div>
              <div className="text-2xl font-bold text-white">{stats.audioChunks}</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
              <div className="text-zinc-500 font-semibold mb-1">Screenshots</div>
              <div className="text-2xl font-bold text-white">{stats.screenshots}</div>
            </div>
          </div>
          <button 
            onClick={stopAndProcess}
            className="bg-zinc-900 border border-zinc-800 px-6 py-2 rounded-xl hover:bg-zinc-800 transition-all font-medium"
          >
            Stop Capture & Process
          </button>
        </div>
      )}

      {/* Hidden elements for media processing */}
      <video ref={videoRef} autoPlay muted playsInline className="hidden" />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
