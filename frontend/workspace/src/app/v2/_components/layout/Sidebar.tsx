"use client";

import { BookOpen, LayoutDashboard, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar() {
  const pathname = usePathname() || "";

  const isActive = (path: string) => pathname.startsWith(path);

  return (
    <aside className="w-64 h-screen border-r border-border bg-background/50 backdrop-blur-xl flex-col p-6 z-10 shrink-0 hidden md:flex">
      <div className="font-display font-bold text-2xl tracking-tight mb-10 flex items-center gap-2 text-white">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow">
          <span className="text-white text-lg font-bold">D</span>
        </div>
        DAMAK
      </div>

      <nav className="space-y-2 flex-1">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 ml-2">Workspace</div>
        <Link 
          href="/v2/dashboard" 
          className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors font-medium focus-visible:ring-2 focus-visible:ring-primary ${isActive("/v2/dashboard") ? "bg-white/10 text-white border border-white/5 shadow-[0_0_15px_rgba(255,255,255,0.05)]" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}
        >
          <LayoutDashboard className={`w-4 h-4 ${isActive("/v2/dashboard") ? "text-primary" : ""}`} />
          Dashboard
        </Link>
        <Link 
          href="/v2/library" 
          className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors font-medium focus-visible:ring-2 focus-visible:ring-primary ${isActive("/v2/library") ? "bg-white/10 text-white border border-white/5 shadow-[0_0_15px_rgba(255,255,255,0.05)]" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}
        >
          <BookOpen className={`w-4 h-4 ${isActive("/v2/library") ? "text-primary" : ""}`} />
          Library
        </Link>
      </nav>
      
      <button 
        className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-medium shadow-glow hover:shadow-floating transition-all flex items-center justify-center gap-2 mt-auto focus-visible:ring-2 focus-visible:ring-white"
        aria-label="Create New Session"
      >
        <Plus className="w-5 h-5" />
        New Session
      </button>
    </aside>
  );
}
