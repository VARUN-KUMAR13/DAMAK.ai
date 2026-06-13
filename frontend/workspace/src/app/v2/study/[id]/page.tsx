"use client";

import { useEffect, useState, useRef } from "react";
import { ChevronLeft, Download, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { NotesPanel } from "../../_components/workspace/NotesPanel";
import { TutorPanel } from "../../_components/workspace/TutorPanel";
import { useSessionsStore } from "../../../../store/sessions.store";
import { useNotesStore } from "../../../../store/notes.store";
import { JobDetailResponse } from "../../../../lib/api-types";
import { JobsService } from "../../../../lib/services/jobs.service";

export default function V2StudyWorkspace() {
  const params = useParams();
  const id = params.id as string;
  
  const [job, setJob] = useState<JobDetailResponse | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const { sessions } = useSessionsStore();
  const { currentNotes, isLoading: isNotesLoading, error: notesError, generateNotes } = useNotesStore();

  const initialized = useRef(false);

  useEffect(() => {
    // 1. Fetch Job Metadata
    const fetchJob = async () => {
      try {
        // Try to find it in store first to avoid unnecessary network
        const existingJob = sessions.find(s => s.job_id === id);
        if (existingJob) {
          setJob(existingJob);
        } else {
          // If not in store, fetch it directly
          const fetchedJob = await JobsService.getJob(id);
          setJob(fetchedJob);
        }
      } catch (err: any) {
        setJobError(err.message || "Failed to load session metadata.");
      }
    };
    fetchJob();
  }, [id, sessions]);

  useEffect(() => {
    // 2. Automatically generate notes if missing
    if (job && !currentNotes && !isNotesLoading && !notesError && !initialized.current) {
      initialized.current = true;
      generateNotes(id);
    }
  }, [job, id, currentNotes, isNotesLoading, notesError, generateNotes]);

  const handleRetryNotes = () => {
    generateNotes(id);
  };

  const exportPDF = async () => {
    setIsExporting(true);
    try {
      // Dynamically import html2pdf only on client side when needed
      const html2pdf = (await import("html2pdf.js")).default;
      const element = document.getElementById("pdf-export-content");
      if (!element) return;

      const opt = {
        margin: 10,
        filename: `${job?.source_filename || 'Notes'}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error("PDF Export failed", err);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const title = job?.source_filename || "Untitled Session";

  if (jobError) {
    return (
      <div className="flex flex-1 items-center justify-center overflow-hidden">
        <div className="flex flex-col items-center p-8 bg-white/5 border border-red-500/20 rounded-2xl">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-xl font-display text-white mb-2">Failed to load session</h2>
          <p className="text-red-400 text-sm mb-6">{jobError}</p>
          <Link href="/v2/dashboard" className="px-6 py-2 bg-white/10 hover:bg-white/15 rounded-full text-white text-sm font-medium transition-colors">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden relative">
      {/* Top Bar for Workspace */}
      <header className="absolute top-0 left-0 right-0 h-16 bg-background/70 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 z-30">
        <div className="flex items-center gap-4">
          <Link href="/v2/dashboard" className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-primary">
            <ChevronLeft className="w-4 h-4 text-white" aria-hidden="true" />
            <span className="sr-only">Back to Dashboard</span>
          </Link>
          <div className="h-4 w-px bg-white/10"></div>
          <div className="font-display font-medium text-lg text-white line-clamp-1">{title}</div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportPDF}
            disabled={isNotesLoading || !currentNotes || isExporting}
            className="px-4 py-2 text-sm font-medium bg-white/5 border border-white/10 rounded-full hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-primary"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" aria-hidden="true" />}
            <span className="hidden sm:inline">{isExporting ? "Exporting..." : "Export Document"}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      {notesError ? (
        <main className="flex-1 overflow-y-auto pb-32 relative custom-scrollbar px-8 pt-24 flex flex-col items-center">
          <div className="max-w-[720px] w-full mt-20 flex flex-col items-center bg-red-500/5 border border-red-500/20 p-8 rounded-2xl">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <h2 className="text-xl font-display text-white mb-2">Notes Generation Failed</h2>
            <p className="text-red-400 text-sm text-center mb-6 max-w-md">{notesError}</p>
            <button onClick={handleRetryNotes} className="px-6 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Retry Generation
            </button>
          </div>
        </main>
      ) : (
        <NotesPanel job={job} notes={currentNotes} isLoading={isNotesLoading || !job} />
      )}

      {/* Extracted Tutor Panel */}
      <TutorPanel jobId={id} />
    </div>
  );
}
