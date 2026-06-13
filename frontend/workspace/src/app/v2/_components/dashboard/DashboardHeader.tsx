"use client";

import { Search } from "lucide-react";

export interface DashboardHeaderProps {
  userName?: string;
  pendingReviewsCount?: number;
}

/**
 * DashboardHeader
 * 
 * Purpose: Top header of the dashboard containing greeting and global search.
 * Props: `DashboardHeaderProps` (userName, pendingReviewsCount)
 * Dependencies: `lucide-react`
 */
export function DashboardHeader({ userName = "User", pendingReviewsCount = 0 }: DashboardHeaderProps) {
  return (
    <header className="flex flex-col md:flex-row md:justify-between md:items-end mb-12 gap-6">
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-white mb-2">Good afternoon.</h1>
        <p className="text-muted-foreground text-lg">
          You have <span className="text-primary font-medium">{pendingReviewsCount} lectures</span> waiting for review.
        </p>
      </div>
      
      {/* Global Command Search */}
      <div className="relative w-full md:w-72">
        <input 
          type="text" 
          placeholder="Search knowledge base... (⌘K)" 
          className="w-full bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:bg-white/10 transition-all placeholder:text-muted-foreground backdrop-blur-md"
        />
        <Search className="w-4 h-4 absolute left-4 top-3 text-muted-foreground" aria-hidden="true" />
      </div>
    </header>
  );
}
