"use client";

import { motion } from "framer-motion";
import { JobDetailResponse } from "../../../../lib/api-types";

export interface DashboardStatsProps {
  sessions: JobDetailResponse[];
  isLoading?: boolean;
}

/**
 * DashboardStats
 * 
 * Purpose: Renders AI insights and metrics directly derived from the core jobs endpoint.
 */
export function DashboardStats({ sessions, isLoading = false }: DashboardStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-full">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white/5 rounded-2xl p-6 animate-pulse border border-white/10">
            <div className="h-4 bg-white/10 w-20 rounded mb-4"></div>
            <div className="h-8 bg-white/10 w-12 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  const total = sessions.length;
  const completed = sessions.filter(s => s.status === "completed").length;
  const processing = sessions.filter(s => s.status === "processing" || s.status === "pending").length;
  const failed = sessions.filter(s => s.status === "failed").length;

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const createdThisWeek = sessions.filter(s => {
    if (!s.created_at) return false;
    const created = new Date(s.created_at);
    return created >= oneWeekAgo;
  }).length;

  const stats = [
    { label: "Total Sessions", value: total, trend: `+${createdThisWeek} this week` },
    { label: "Completed", value: completed, color: "text-emerald-400" },
    { label: "Processing", value: processing, color: "text-primary" },
    { label: "Failed", value: failed, color: "text-red-400" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-full">
      {stats.map((stat, i) => (
        <motion.div 
          key={stat.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-5 relative overflow-hidden"
        >
          <div className="text-xs font-medium text-muted-foreground mb-2">{stat.label}</div>
          <div className={`font-display text-3xl font-bold ${stat.color || "text-white"}`}>
            {stat.value}
          </div>
          {stat.trend && (
            <div className="text-[10px] mt-2 text-zinc-400">{stat.trend}</div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
