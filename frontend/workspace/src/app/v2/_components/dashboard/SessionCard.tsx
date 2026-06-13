"use client";

import { PlayCircle, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { JobDetailResponse, JobStatus } from "../../../../lib/api-types";

export interface SessionCardProps {
  session?: JobDetailResponse;
  isLoading?: boolean;
}

/**
 * SessionCard
 * 
 * Purpose: Displays a single study session on the dashboard with rich metadata.
 * Props: `SessionCardProps` (session data, isLoading flag)
 */
export function SessionCard({ session, isLoading }: SessionCardProps) {
  if (isLoading || !session) {
    return (
      <div className="bg-white/5 border border-white/5 rounded-2xl p-5 relative overflow-hidden animate-pulse shadow-card">
        <div className="aspect-video bg-white/10 rounded-xl mb-4 relative overflow-hidden"></div>
        <div className="w-16 h-4 bg-white/10 rounded mb-2"></div>
        <div className="w-3/4 h-6 bg-white/10 rounded mb-2"></div>
        <div className="w-full h-4 bg-white/10 rounded"></div>
      </div>
    );
  }

  const { job_id, title, status, progress_stage, created_at, transcript } = {
    ...session,
    title: session.source_filename || "Untitled Session"
  };

  // Determine duration from transcript if available
  let durationString = "--";
  if (transcript && transcript.segments && transcript.segments.length > 0) {
    const lastSeg = transcript.segments[transcript.segments.length - 1];
    const mins = Math.floor(lastSeg.end / 60);
    durationString = `${mins}m`;
  }

  // Format Date
  const dateStr = created_at ? new Date(created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "Recent";

  if (status === "pending" || status === "processing") {
    return (
      <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/5 rounded-2xl p-5 cursor-not-allowed relative overflow-hidden shadow-card">
        <div className="absolute inset-0 bg-primary/5 opacity-50"></div>
        <div className="aspect-video bg-[#1a1a1a] rounded-xl mb-4 relative overflow-hidden border border-white/5 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-primary/20 text-primary border border-primary/20">
            {status === "pending" ? "Pending in Queue" : "Processing"}
          </span>
          <span className="text-xs text-muted-foreground">{dateStr}</span>
        </div>
        <h3 className="font-display text-lg font-semibold text-zinc-400 mb-1 leading-tight">{title}</h3>
        <p className="text-xs text-muted-foreground line-clamp-1">{progress_stage || "Extracting intelligence..."}</p>
        <div className="w-full bg-white/10 h-1.5 rounded-full mt-4 overflow-hidden relative">
          <div className="bg-gradient-to-r from-accent to-primary w-2/3 h-full rounded-full relative">
            <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 relative overflow-hidden shadow-card">
        <div className="aspect-video bg-[#1a1a1a] rounded-xl mb-4 relative overflow-hidden border border-white/5 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-red-500/20 text-red-400 border border-red-500/20">
            Failed
          </span>
          <span className="text-xs text-muted-foreground">{dateStr}</span>
        </div>
        <h3 className="font-display text-lg font-semibold text-white mb-1 leading-tight line-clamp-1">{title}</h3>
        <p className="text-xs text-red-400 line-clamp-2">{session.error_message || "An unknown error occurred during processing."}</p>
      </div>
    );
  }

  // COMPLETED STATUS
  return (
    <Link href={`/v2/study/${job_id}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl">
      <motion.div 
        whileHover={{ y: -5, scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="bg-gradient-to-b from-white/5 to-transparent border border-white/5 hover:border-primary/40 rounded-2xl p-5 cursor-pointer group shadow-card"
      >
        <div className="aspect-video bg-[#1a1a1a] rounded-xl mb-4 relative overflow-hidden border border-white/5">
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3 z-10">
            <span className="px-2 py-1 bg-black/60 backdrop-blur-md rounded text-xs font-medium border border-white/10 text-white">{durationString}</span>
          </div>
          <div className="absolute inset-0 flex items-center justify-center opacity-50 group-hover:scale-105 transition-transform duration-500">
            <PlayCircle className="w-16 h-16 text-primary" strokeWidth={1} />
          </div>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </span>
          <span className="text-xs text-muted-foreground">{dateStr}</span>
        </div>
        <h3 className="font-display text-lg font-semibold text-white mb-1 leading-tight group-hover:text-primary transition-colors line-clamp-1">{title}</h3>
      </motion.div>
    </Link>
  );
}
