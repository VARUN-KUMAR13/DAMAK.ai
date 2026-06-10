"use client";

import React, { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import GlobalOmnibar from "@/components/GlobalOmnibar";
import { api } from "@/lib/api";
import { Network, Loader2, TrendingUp, BookOpen, AlertCircle } from "lucide-react";
import dynamic from 'next/dynamic';

// NextJS dynamic import to avoid SSR issues with ForceGraph
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

export default function KnowledgeBrainDashboard() {
  const [graphData, setGraphData] = useState<any>({ nodes: [], links: [] });
  const [analytics, setAnalytics] = useState<any>(null);
  const [timeline, setTimeline] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [gRes, aRes, tRes] = await Promise.all([
          api.get("/api/v1/graph/global"),
          api.get("/api/v1/analytics/dashboard"),
          api.get("/api/v1/analytics/timeline")
        ]);
        setGraphData(gRes.data);
        setAnalytics(aRes.data);
        setTimeline(tRes.data);
      } catch (e) {
        console.error("Failed to load brain data", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="flex h-screen bg-background overflow-hidden text-sm">
      <GlobalOmnibar />
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 overflow-y-auto border-x border-zinc-800">
        <header className="w-full flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Network className="text-blue-500 w-8 h-8" />
            Global Brain
          </h1>
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-zinc-600 animate-spin" />
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-3 gap-6">
            
            {/* Left Col: Graph Visualization */}
            <div className="col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden relative shadow-2xl flex flex-col">
              <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm z-10 flex justify-between items-center">
                 <h2 className="font-bold flex items-center gap-2">
                   <Network size={18} className="text-blue-400" />
                   Knowledge Network
                 </h2>
                 <span className="text-xs text-zinc-500">{graphData.nodes?.length || 0} Nodes</span>
              </div>
              <div className="flex-1 w-full bg-zinc-950 relative">
                {graphData.nodes?.length > 0 ? (
                  typeof window !== "undefined" && (
                     <ForceGraph2D
                       graphData={graphData}
                       nodeLabel="label"
                       nodeColor={(n: any) => n.type === 'Lecture' ? '#3b82f6' : '#f59e0b'}
                       nodeRelSize={6}
                       linkColor={() => '#3f3f46'}
                       backgroundColor="#09090b"
                       width={800} // Need a resize observer ideally
                       height={600}
                     />
                  )
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 p-8 text-center">
                     <AlertCircle size={48} className="mb-4 opacity-50" />
                     <p>Your Knowledge Graph is empty.</p>
                     <p className="text-xs mt-2">Upload a lecture to begin background concept extraction.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Col: Analytics & Timeline */}
            <div className="col-span-1 space-y-6 flex flex-col">
              
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                 <h2 className="font-bold flex items-center gap-2 mb-6">
                   <TrendingUp size={18} className="text-green-400" />
                   Learning Analytics
                 </h2>
                 <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                      <span className="text-zinc-400">Cards Learned</span>
                      <span className="font-bold text-lg text-white">{analytics?.cards_learned || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                      <span className="text-zinc-400">Retention Rate</span>
                      <span className="font-bold text-lg text-green-400">{analytics?.retention_rate}%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                      <span className="text-zinc-400">Study Streak</span>
                      <span className="font-bold text-lg text-orange-400">{analytics?.streak_days} Days 🔥</span>
                    </div>
                 </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex-1">
                 <h2 className="font-bold flex items-center gap-2 mb-6">
                   <BookOpen size={18} className="text-purple-400" />
                   Learning Timeline
                 </h2>
                 {timeline?.timeline?.map((block: any, idx: number) => (
                    <div key={idx} className="relative pl-6 border-l border-zinc-800 mb-8 last:mb-0">
                      <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 bg-blue-500 rounded-full"></div>
                      <h3 className="font-bold text-white mb-2">{block.date}</h3>
                      <div className="flex flex-wrap gap-2">
                        {block.concepts?.length > 0 ? block.concepts.map((c: string, i: number) => (
                          <span key={i} className="px-2 py-1 bg-zinc-800 rounded-md text-xs text-zinc-300">
                            {c}
                          </span>
                        )) : (
                          <span className="text-xs text-zinc-600 italic">No new concepts identified.</span>
                        )}
                      </div>
                    </div>
                 ))}
              </div>

            </div>

          </div>
        )}
      </main>
    </div>
  );
}
