"use client";

import { BookOpen, LayoutDashboard, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileNav() {
  const pathname = usePathname() || "";
  const isActive = (path: string) => pathname.startsWith(path);

  return (
    <nav className="md:hidden fixed bottom-0 w-full h-20 bg-background/90 backdrop-blur-xl border-t border-white/10 flex justify-around items-center px-6 z-50 pb-safe">
      <Link 
        href="/v2/dashboard" 
        className={`flex flex-col items-center gap-1 transition-colors p-2 rounded-lg focus-visible:ring-2 focus-visible:ring-primary ${isActive("/v2/dashboard") ? "text-white" : "text-muted-foreground hover:text-zinc-300"}`}
      >
        <LayoutDashboard className="w-6 h-6" />
        <span className="text-[10px] font-medium">Home</span>
      </Link>
      
      <Link 
        href="/v2/library" 
        className={`flex flex-col items-center gap-1 transition-colors p-2 rounded-lg focus-visible:ring-2 focus-visible:ring-primary ${isActive("/v2/library") ? "text-white" : "text-muted-foreground hover:text-zinc-300"}`}
      >
        <BookOpen className="w-6 h-6" />
        <span className="text-[10px] font-medium">Library</span>
      </Link>
      
      {/* Floating Action Button */}
      <button 
        className="relative -top-5 flex flex-col items-center group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-full"
        aria-label="New Session"
      >
        <div className="w-14 h-14 bg-gradient-to-tr from-primary to-accent rounded-full flex items-center justify-center text-white shadow-glow border-4 border-background group-hover:scale-105 transition-transform">
          <Plus className="w-6 h-6" />
        </div>
      </button>
    </nav>
  );
}
