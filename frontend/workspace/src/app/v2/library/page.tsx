"use client";

import { BookOpen, UploadCloud } from "lucide-react";
import { motion } from "framer-motion";

export default function V2LibraryPage() {
  return (
    <div className="flex-1 p-4 md:p-10 lg:p-16 overflow-y-auto custom-scrollbar">
      <header className="mb-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-white mb-2">Knowledge Library</h1>
        <p className="text-muted-foreground text-lg">Your centralized repository of AI-processed learning materials.</p>
      </header>

      {/* Premium Empty State */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="flex flex-col items-center justify-center py-24 px-4 bg-white/5 border border-white/10 rounded-3xl relative overflow-hidden"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="w-20 h-20 bg-gradient-to-tr from-white/5 to-white/10 border border-white/10 rounded-2xl flex items-center justify-center mb-6 shadow-glow relative z-10">
          <BookOpen className="w-10 h-10 text-muted-foreground" />
        </div>
        
        <h2 className="font-display text-2xl font-semibold text-white mb-3 text-center">Your library is currently empty</h2>
        <p className="text-muted-foreground text-center max-w-md mb-8">
          Upload your first lecture, presentation, or meeting recording. The AI Mentor will process it and generate your personalized study guide.
        </p>
        
        <button 
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-medium shadow-glow hover:shadow-floating transition-all flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-white relative z-10"
        >
          <UploadCloud className="w-5 h-5" />
          Upload New Material
        </button>
      </motion.div>
    </div>
  );
}
