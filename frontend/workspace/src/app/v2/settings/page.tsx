"use client";

import { Settings as SettingsIcon, User, Palette, BrainCircuit } from "lucide-react";
import { motion } from "framer-motion";

export default function V2SettingsPage() {
  return (
    <div className="flex-1 p-4 md:p-10 lg:p-16 overflow-y-auto custom-scrollbar">
      <header className="mb-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-white mb-2">Settings</h1>
        <p className="text-muted-foreground text-lg">Manage your account, preferences, and AI mentor settings.</p>
      </header>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Settings Sidebar */}
        <div className="w-full md:w-64 shrink-0 space-y-2">
          <button className="w-full text-left px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white font-medium flex items-center gap-3">
            <User className="w-4 h-4 text-primary" /> Profile
          </button>
          <button className="w-full text-left px-4 py-3 hover:bg-white/5 rounded-xl text-muted-foreground hover:text-white transition-colors font-medium flex items-center gap-3">
            <Palette className="w-4 h-4" /> Appearance
          </button>
          <button className="w-full text-left px-4 py-3 hover:bg-white/5 rounded-xl text-muted-foreground hover:text-white transition-colors font-medium flex items-center gap-3">
            <BrainCircuit className="w-4 h-4" /> AI Preferences
          </button>
        </div>

        {/* Settings Content */}
        <motion.div 
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex-1 bg-white/5 border border-white/10 rounded-3xl p-8"
        >
          <h2 className="font-display text-2xl font-semibold text-white mb-6">Profile Settings</h2>
          
          <div className="space-y-6 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Full Name</label>
              <input 
                type="text" 
                defaultValue="Varun" 
                className="w-full bg-[#141414] border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary focus-visible:ring-1 focus-visible:ring-primary transition-colors"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Email Address</label>
              <input 
                type="email" 
                defaultValue="varun@example.com" 
                disabled
                className="w-full bg-[#0a0a0a] border border-border rounded-xl px-4 py-3 text-zinc-500 cursor-not-allowed"
              />
            </div>

            <button className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary">
              Save Changes
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
