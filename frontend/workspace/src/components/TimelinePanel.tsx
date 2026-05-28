"use client";

import React from "react";
import { useStore } from "@/store/useStore";
import { Image as ImageIcon } from "lucide-react";

export default function TimelinePanel() {
  const { currentScreenshots, currentSessionId, setHighlightedTimestamp } = useStore();

  return (
    <div className="h-64 flex flex-col border-b border-zinc-800">
      <div className="p-4 border-b border-zinc-800 flex items-center gap-2 font-semibold text-zinc-400">
        <ImageIcon size={18} />
        Screenshot Timeline
      </div>
      <div className="flex-1 overflow-x-auto p-4 flex gap-4 scrollbar-hide">
        {currentScreenshots.length > 0 ? (
          currentScreenshots.map((s, i) => (
            <div key={i} className="flex-shrink-0 w-40 flex flex-col gap-2">
              <div 
                onClick={() => setHighlightedTimestamp(s.timestamp)}
                className="aspect-video bg-zinc-900 rounded-md overflow-hidden border border-zinc-800 hover:border-white transition-all cursor-pointer relative group"
              >
                <img 
                  src={`http://localhost:8000/storage/screenshots/${currentSessionId}/${s.filename}`} 
                  alt={s.filename}
                  className="w-full h-full object-cover"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="text-xs font-mono">Jump to {Math.floor(s.timestamp / 60)}:{(s.timestamp % 60).toFixed(0).padStart(2, '0')}</span>
                </div>
              </div>
              <span className="text-[10px] text-center text-zinc-500 font-mono">
                {Math.floor(s.timestamp / 60)}:{(s.timestamp % 60).toFixed(0).padStart(2, '0')}
              </span>
            </div>
          ))
        ) : (
          <div className="w-full flex items-center justify-center text-zinc-600 italic">No screenshots available</div>
        )}
      </div>
    </div>
  );
}
