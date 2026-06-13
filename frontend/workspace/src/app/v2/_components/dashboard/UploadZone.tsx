"use client";

import { UploadCloud, FileVideo, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef } from "react";
import { useSessionsStore } from "../../../../store/sessions.store";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/wav', 'audio/x-m4a'];

export function UploadZone() {
  const { isUploading, uploadProgress, uploadFileName, uploadFileSize, uploadSession, error } = useSessionsStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayError = localError || error;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isUploading) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const validateFile = (file: File): boolean => {
    setLocalError(null);
    setIsSuccess(false);

    if (!file) {
      setLocalError("No file detected.");
      return false;
    }
    if (file.size === 0) {
      setLocalError("File is empty.");
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      setLocalError(`File exceeds 500MB limit. (${(file.size / (1024 * 1024)).toFixed(1)}MB)`);
      return false;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setLocalError(`Unsupported file format: ${file.type || 'Unknown'}. Please upload MP4, WebM, MP3, or WAV.`);
      return false;
    }
    return true;
  };

  const handleFile = async (file: File) => {
    if (isUploading) return;
    if (!validateFile(file)) return;

    try {
      await uploadSession(file);
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 3000); // Reset success state after 3s
    } catch (err) {
      // Error is caught and stored in Zustand store
      console.error("Upload failed", err);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
      e.target.value = ''; // Reset input
    }
  };

  const handleClick = () => {
    if (!isUploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="h-full relative">
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden" 
        accept="video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/x-m4a"
      />

      <motion.div 
        whileHover={!isUploading ? { scale: 1.02 } : {}}
        whileTap={!isUploading ? { scale: 0.98 } : {}}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`border-dashed border-2 transition-all rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer group backdrop-blur-xl h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary relative overflow-hidden
          ${isDragOver ? 'border-primary bg-primary/10 scale-[1.02]' : 'border-white/20 bg-black/20 hover:border-primary/50 shadow-glow'}
          ${isUploading ? 'cursor-not-allowed opacity-90' : ''}
          ${displayError ? 'border-red-500/50 bg-red-500/5' : ''}
          ${isSuccess ? 'border-emerald-500/50 bg-emerald-500/5' : ''}
        `}
        role="button"
        tabIndex={0}
        aria-label="Upload a new lecture video"
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        <AnimatePresence mode="wait">
          {/* STATE: SUCCESS */}
          {isSuccess && (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center w-full"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3 text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <span className="font-medium text-emerald-400 text-center">Upload Complete!</span>
              <span className="text-xs text-muted-foreground mt-1 text-center">Processing has started.</span>
            </motion.div>
          )}

          {/* STATE: UPLOADING */}
          {isUploading && !isSuccess && (
            <motion.div 
              key="uploading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center w-full px-4"
            >
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-3 text-primary">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <span className="font-medium text-white text-center line-clamp-1 w-full">{uploadFileName || 'Uploading...'}</span>
              <div className="flex items-center justify-between w-full mt-2 text-xs text-muted-foreground">
                <span>{uploadFileSize ? formatSize(uploadFileSize) : ''}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-white/10 h-2 rounded-full mt-2 overflow-hidden">
                <motion.div 
                  className="bg-gradient-to-r from-accent to-primary h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ ease: "linear", duration: 0.2 }}
                />
              </div>
            </motion.div>
          )}

          {/* STATE: IDLE / ERROR */}
          {!isUploading && !isSuccess && (
            <motion.div 
              key="idle"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex flex-col items-center"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-transform ${displayError ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-muted-foreground group-hover:text-primary group-hover:scale-110'}`}>
                {displayError ? <AlertCircle className="w-6 h-6" /> : (isDragOver ? <FileVideo className="w-6 h-6" /> : <UploadCloud className="w-6 h-6" />)}
              </div>
              <span className={`font-medium text-center ${displayError ? 'text-red-400' : 'text-white'}`}>
                {displayError ? 'Upload Failed' : (isDragOver ? 'Drop to upload' : 'Drag lecture video here')}
              </span>
              <span className={`text-xs mt-1 text-center max-w-[200px] ${displayError ? 'text-red-400/80' : 'text-muted-foreground'}`}>
                {displayError ? displayError : 'or click to browse files (Max 500MB)'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
