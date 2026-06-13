"use client";

import React, { useState } from "react";
import { useStore } from "@/store/useStore";
import { Sparkles, FileText, Download, Layers } from "lucide-react";
import { api } from "@/lib/api";
import ReactMarkdown from "react-markdown";

export default function NotesPanel() {
  const { currentSessionId, currentNotes, currentNotesKeyConcepts, currentNotesCitations, setNotes, setHighlightedTimestamp } = useStore();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("standard");
  const [generationDuration, setGenerationDuration] = useState<number | null>(null);

  const generateNotes = async () => {
    if (!currentSessionId) return;
    setLoading(true);
    setGenerationDuration(null);
    const t0 = Date.now();
    try {
      const res = await api.post("/api/v1/intelligence/notes/generate", {
        session_id: currentSessionId,
        mode: mode
      });
      setNotes(res.data.content, res.data.key_concepts, res.data.citations);
      setGenerationDuration((Date.now() - t0) / 1000);
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail || "An unexpected error occurred during notes generation.";
      console.error("Notes generation failed:", err);
      alert(`Notes generation failed: ${errorDetail}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadNotes = () => {
    if (!currentNotes) return;
    const blob = new Blob([currentNotes], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DAMAK_AI_Notes_${currentSessionId?.substring(0, 8) ?? "session"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = async () => {
    if (!currentNotes) return;
    setLoading(true);
    try {
        // @ts-ignore
        const html2pdf = (await import('html2pdf.js')).default;
        const element = document.getElementById('pdf-export-container');
        if (!element) return;
        
        const opt = {
            margin: 15,
            filename: `DAMAK_AI_Notes_${currentSessionId?.substring(0, 8) ?? "session"}.pdf`,
            image: { type: 'jpeg' as const, quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, letterRendering: true },
            jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };
        
        // Ensure images are fully loaded before rendering
        const images = element.getElementsByTagName('img');
        await Promise.all(Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => { img.onload = img.onerror = resolve; });
        }));

        await html2pdf().set(opt).from(element).save();
    } catch (err) {
        console.error("PDF generation failed", err);
        alert("Failed to generate PDF. Make sure all images are loaded.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
              <FileText size={20} />
           </div>
           <div>
              <h3 className="text-xl font-bold">AI Lecture Notes</h3>
              <p className="text-zinc-500 text-xs">Structured knowledge from multimodal context</p>
           </div>
        </div>
        
        <div className="flex gap-2">
           <select 
             value={mode}
             onChange={(e) => setMode(e.target.value)}
             className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
           >
              <option value="easy">Easy</option>
              <option value="standard">Standard</option>
              <option value="deep">Deep Dive</option>
              <option value="exam">Exam Focus</option>
           </select>
           <button 
             onClick={generateNotes}
             disabled={loading || !currentSessionId}
             className="flex items-center gap-2 bg-white text-black px-4 py-1.5 rounded-lg font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50"
           >
             {loading ? <Sparkles size={16} className="animate-spin" /> : <Sparkles size={16} />}
             <span>{currentNotes ? 'Regenerate' : 'Generate Notes'}</span>
           </button>
           {currentNotes && (
             <div className="flex gap-2">
               <button 
                 onClick={downloadPDF}
                 disabled={loading}
                 className="flex items-center gap-2 bg-purple-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 text-xs"
               >
                 <span>Download PDF</span>
               </button>
               <button 
                 onClick={downloadNotes}
                 className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors"
                 title="Download Markdown"
               >
                 <Download size={18} />
               </button>
             </div>
           )}
        </div>
      </div>

      {!currentNotes && !loading && (
        <div className="border-2 border-dashed border-zinc-800 rounded-3xl py-20 text-center">
           <Layers className="mx-auto w-12 h-12 text-zinc-800 mb-4" />
           <p className="text-zinc-600 mb-2">No notes generated yet for this session.</p>
           <p className="text-zinc-700 text-xs">AI will use OCR slide text and transcript to build your study guide.</p>
        </div>
      )}

      {loading && (
        <div className="space-y-4 animate-pulse">
           <div className="h-8 bg-zinc-900 rounded w-1/4"></div>
           <div className="h-4 bg-zinc-900 rounded w-full"></div>
           <div className="h-4 bg-zinc-900 rounded w-full"></div>
           <div className="h-4 bg-zinc-900 rounded w-3/4"></div>
           <div className="h-40 bg-zinc-900 rounded w-full"></div>
        </div>
      )}

      {currentNotes && (
        <div className="flex gap-6 items-start">
          {/* Visible UI Container */}
          <div className="flex-1 prose prose-invert prose-zinc max-w-none bg-zinc-950/50 border border-zinc-800 p-10 rounded-3xl shadow-2xl">
            <div className="mb-8 border-b border-zinc-800 pb-4">
               <h1 className="text-3xl font-bold text-white mb-2">Lecture Notes</h1>
               <p className="text-zinc-400">Generated by DAMAK AI</p>
            </div>
            <ReactMarkdown
              components={{
                img: ({node, ...props}) => {
                  const src = props.src?.startsWith('/') ? `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}${props.src}` : props.src;
                  return <img {...props} src={src} alt={props.alt || "Note Image"} />;
                }
              }}
            >
              {currentNotes}
            </ReactMarkdown>
            {generationDuration !== null && (
               <div className="mt-12 text-xs text-zinc-500 italic text-right border-t border-zinc-800/50 pt-4">
                  Generated in {generationDuration.toFixed(1)}s
               </div>
            )}
          </div>
          
          {/* Hidden PDF Export Container */}
          <div className="fixed top-[10000px] left-0 w-[800px] bg-white text-black p-10 print-container" id="pdf-export-container">
            <style>{`
              #pdf-export-container { font-family: sans-serif; background-color: white; }
              #pdf-export-container img { max-width: 100%; height: auto; border-radius: 8px; margin: 16px 0; page-break-inside: avoid; border: 1px solid #e5e7eb; }
              #pdf-export-container h1, #pdf-export-container h2, #pdf-export-container h3, #pdf-export-container h4 { page-break-after: avoid; color: #111827 !important; margin-top: 24px; margin-bottom: 12px; }
              #pdf-export-container p, #pdf-export-container li { page-break-inside: avoid; color: #374151 !important; line-height: 1.6; }
              #pdf-export-container blockquote { border-left: 4px solid #8b5cf6; padding-left: 16px; color: #111827 !important; background-color: #f3f4f6; padding: 12px; border-radius: 4px; }
              #pdf-export-container code, #pdf-export-container pre { color: #111827 !important; background-color: #f3f4f6; padding: 2px 4px; border-radius: 4px; }
              #pdf-export-container strong { color: #111827 !important; font-weight: bold; }
              #pdf-export-container .cover-page { height: 900px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; page-break-after: always; }
            `}</style>
            
            <div className="cover-page">
               <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mb-6">
                 <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>
               </div>
               <h1 className="text-5xl font-extrabold text-black mb-4">DAMAK AI Study Guide</h1>
               <h2 className="text-2xl text-gray-600 mb-8">Comprehensive Lecture Notes</h2>
               <div className="w-24 h-1 bg-purple-600 mb-8"></div>
               <p className="text-gray-500 font-medium text-lg">Generated on {new Date().toLocaleDateString()}</p>
            </div>
            
            <div className="prose prose-slate max-w-none text-black">
               <ReactMarkdown
                 components={{
                   img: ({node, ...props}) => {
                     const src = props.src?.startsWith('/') ? `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}${props.src}` : props.src;
                     return <img {...props} src={src} alt={props.alt || "Note Image"} />;
                   }
                 }}
               >
                 {currentNotes}
               </ReactMarkdown>
            </div>
            
            <div className="mt-12 pt-8 border-t border-gray-200 text-center text-sm text-gray-400">
               Created with DAMAK AI Multimodal Learning Engine
            </div>
          </div>
          
          <div className="w-64 flex flex-col gap-4">
            {currentNotesKeyConcepts && currentNotesKeyConcepts.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
                <h4 className="font-semibold text-zinc-300 mb-3 text-sm flex items-center gap-2">
                  <Sparkles size={14} className="text-purple-400" />
                  Key Concepts
                </h4>
                <div className="flex flex-wrap gap-2">
                  {currentNotesKeyConcepts.map((concept, idx) => (
                    <span key={idx} className="bg-zinc-800 text-zinc-300 text-xs px-2 py-1 rounded-md">
                      {concept}
                    </span>
                  ))}
                </div>
              </div>
            )}
            

          </div>
        </div>
      )}
    </div>
  );
}
