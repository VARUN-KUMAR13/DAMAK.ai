"use client";

import React, { useEffect, useRef } from "react";
import { useStore } from "@/store/useStore";
import { MessageSquareText } from "lucide-react";

export default function TranscriptPanel() {
  const { currentTranscript, highlightedTimestamp } = useStore();
  const transcriptRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (highlightedTimestamp !== null) {
      // Find the segment that contains this timestamp
      const index = currentTranscript.findIndex(
        (seg) => highlightedTimestamp >= seg.start && highlightedTimestamp <= seg.end
      );
      
      if (index !== -1 && itemRefs.current[index]) {
        itemRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightedTimestamp, currentTranscript]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 border-b border-zinc-800 flex items-center gap-2 font-semibold text-zinc-400">
        <MessageSquareText size={18} />
        Transcript
      </div>
      <div ref={transcriptRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {currentTranscript.length > 0 ? (
          currentTranscript.map((seg, i) => (
            <div 
              key={i} 
              ref={(el) => {itemRefs.current[i] = el}}
              className={`group cursor-pointer p-2 rounded-lg transition-all ${
                highlightedTimestamp !== null && highlightedTimestamp >= seg.start && highlightedTimestamp <= seg.end
                ? 'bg-zinc-800 border-l-2 border-white pl-3'
                : 'hover:bg-zinc-900/50'
              }`}
            >
              <span className="text-xs text-zinc-600 mr-2 font-mono">
                {Math.floor(seg.start / 60)}:{(seg.start % 60).toFixed(0).padStart(2, '0')}
              </span>
              <span className="text-zinc-300 leading-relaxed">{seg.text}</span>
            </div>
          ))
        ) : (
          <div className="text-center text-zinc-600 italic py-10">Select a session to view transcript</div>
        )}
      </div>
    </div>
  );
}
