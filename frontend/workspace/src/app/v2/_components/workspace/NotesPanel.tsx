"use client";

import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { JobDetailResponse, NotesResponse } from "../../../../lib/api-types";
import { ImageOff, Loader2, BookOpen, ExternalLink } from "lucide-react";
import Image from "next/image";

export interface NotesPanelProps {
  job: JobDetailResponse | null;
  notes: NotesResponse | null;
  isLoading?: boolean;
}

const MarkdownImage = ({ alt, src }: { alt?: string; src?: string }) => {
  if (!src) return null;
  return (
    <figure className="my-8">
      <div className="rounded-xl border border-white/5 bg-[#0a0a0a] shadow-2xl relative overflow-hidden group">
        <img 
          src={src} 
          alt={alt || "Screenshot"} 
          className="w-full h-auto object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.parentElement?.classList.add('broken-img-fallback');
          }}
        />
        <div className="hidden flex-col items-center text-muted-foreground broken-fallback-content absolute inset-0 justify-center bg-[#141414]">
          <ImageOff className="w-8 h-8 mb-2 opacity-50" />
          <span className="text-sm font-medium">Screenshot unavailable</span>
        </div>
      </div>
      <style jsx>{`
        .broken-img-fallback .broken-fallback-content {
          display: flex;
        }
      `}</style>
    </figure>
  );
};

const KNOWLEDGE_SOURCES = [
  {
    title: "American Academy of Pediatrics (AAP)",
    desc: "Comprehensive guidelines on pediatric history taking and patient care.",
    url: "https://www.aap.org",
    initials: "AAP",
    bg: "bg-blue-900",
    text: "text-blue-100"
  },
  {
    title: "UpToDate",
    desc: "Pediatric history and physical examination in clinical practice.",
    url: "https://www.uptodate.com",
    initials: "UTD",
    bg: "bg-emerald-900",
    text: "text-emerald-100"
  },
  {
    title: "World Health Organization (WHO)",
    desc: "Child health and development resources and guidelines.",
    url: "https://www.who.int/health-topics/child-health",
    initials: "WHO",
    bg: "bg-sky-900",
    text: "text-sky-100"
  },
  {
    title: "Nelson Textbook of Pediatrics",
    desc: "The leading reference in pediatric diagnosis and management.",
    url: "https://www.elsevier.com/nelson-textbook",
    initials: "NTP",
    bg: "bg-orange-900",
    text: "text-orange-100"
  }
];

export function NotesPanel({ job, notes, isLoading }: NotesPanelProps) {
  if (isLoading || !notes || !job) {
    return (
      <main className="flex-1 overflow-y-auto pb-32 relative custom-scrollbar px-8 pt-24 bg-[#0a0a0a]">
        <div className="max-w-[720px] mx-auto animate-pulse">
          <div className="h-12 bg-white/5 w-3/4 rounded-lg mb-12"></div>
          <div className="space-y-6 mb-12">
            <div className="h-4 bg-white/5 w-full rounded"></div>
            <div className="h-4 bg-white/5 w-5/6 rounded"></div>
            <div className="h-4 bg-white/5 w-4/5 rounded"></div>
          </div>
          <div className="aspect-video bg-white/5 rounded-2xl mb-12"></div>
          <div className="space-y-6">
            <div className="h-4 bg-white/5 w-full rounded"></div>
            <div className="h-4 bg-white/5 w-5/6 rounded"></div>
          </div>
        </div>
      </main>
    );
  }

  const title = notes.title || job.source_filename || "Untitled Notes";

  return (
    <main className="flex-1 overflow-y-auto pb-32 relative custom-scrollbar bg-[#0a0a0a]" id="pdf-export-content">
      
      <div className="max-w-[720px] mx-auto pt-24 px-8 md:px-12">
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-4xl md:text-[42px] font-bold tracking-tight text-white mb-10 leading-tight"
        >
          {title}
        </motion.h1>

        {/* Reading Content */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="notes-content prose prose-invert max-w-none 
            prose-headings:font-display prose-headings:font-semibold 
            prose-h2:text-xl prose-h2:text-[#b49cf5] prose-h2:mt-12 prose-h2:mb-4
            prose-p:text-[#d4d4d4] prose-p:text-[15px] prose-p:leading-relaxed 
            prose-strong:text-white prose-li:text-[#d4d4d4] prose-li:text-[15px]"
        >
          <ReactMarkdown
            components={{
              img: ({ node, ...props }) => <MarkdownImage alt={props.alt} src={props.src} />,
              blockquote: ({ node, ...props }) => (
                <div className="border-l-2 border-primary/50 pl-4 my-6 italic text-zinc-300">
                  {props.children}
                </div>
              )
            }}
          >
            {notes.content}
          </ReactMarkdown>
        </motion.div>

        {/* CSS for custom counters matching the screenshot */}
        <style jsx global>{`
          .notes-content {
            counter-reset: h2-counter;
          }
          .notes-content h2 {
            counter-increment: h2-counter;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .notes-content h2::before {
            content: counter(h2-counter);
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            background: rgba(139, 92, 246, 0.15);
            color: #b49cf5;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            flex-shrink: 0;
            font-family: ui-sans-serif, system-ui, sans-serif;
          }
        `}</style>

        {/* Knowledge Sources Section */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-20 pt-10 border-t border-white/5"
        >
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="w-5 h-5 text-zinc-300" />
            <h3 className="text-lg font-semibold text-white font-display">Knowledge Sources</h3>
          </div>
          <p className="text-[14px] text-zinc-400 mb-6">Explore the references and resources that informed this lecture.</p>

          <div className="space-y-3">
            {KNOWLEDGE_SOURCES.map((source, idx) => (
              <a 
                key={idx} 
                href={source.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-[#111111] hover:bg-[#161616] transition-colors group"
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold tracking-wider shrink-0 ${source.bg} ${source.text}`}>
                  {source.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[15px] font-semibold text-white mb-0.5 truncate">{source.title}</h4>
                  <p className="text-[13px] text-zinc-400 truncate mb-1">{source.desc}</p>
                  <span className="text-[12px] text-primary/80 truncate">{source.url}</span>
                </div>
                <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-primary transition-colors shrink-0" />
              </a>
            ))}
          </div>
        </motion.div>
      </div>
    </main>
  );
}
