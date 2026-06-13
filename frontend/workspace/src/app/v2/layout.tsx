import type { Metadata } from "next";
import { Inter, Outfit, Merriweather } from "next/font/google";
import "./v2.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const merriweather = Merriweather({ 
  weight: ['300', '400', '700'],
  style: ['normal', 'italic'],
  subsets: ["latin"], 
  variable: "--font-merriweather" 
});

export const metadata: Metadata = {
  title: "DAMAK AI V2",
  description: "Modern AI Learning Workspace",
};

import { Sidebar } from "./_components/layout/Sidebar";
import { MobileNav } from "./_components/layout/MobileNav";

export default function V2Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${inter.variable} ${outfit.variable} ${merriweather.variable} font-sans antialiased text-white bg-background min-h-screen flex relative overflow-hidden`}>
      {/* Ambient Background Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 blur-[120px] rounded-full pointer-events-none z-0"></div>

      {/* Extracted Sidebar Navigation */}
      <Sidebar />

      {/* Main App Area with fixed padding for mobile nav */}
      <div className="flex-1 flex flex-col z-10 overflow-hidden relative pb-24 md:pb-0">
        {children}
      </div>

      {/* Extracted Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  );
}
