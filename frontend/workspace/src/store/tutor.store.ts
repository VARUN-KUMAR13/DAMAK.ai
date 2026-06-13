import { create } from 'zustand';
import { ChatRequest, RetrievedSource } from '../lib/api-types';
import { TutorService } from '../lib/services/tutor.service';

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: RetrievedSource[];
  isQuiz?: boolean;
  quizOptions?: { id: string, text: string, isCorrect?: boolean }[];
}

interface SessionChatState {
  messages: ChatMessage[];
  isTyping: boolean;
  typingStatus: string | null;
  error: string | null;
  responseStyle: string;
  tone: string;
}

interface TutorState {
  sessions: Record<string, SessionChatState>;
  
  initSession: (jobId: string) => void;
  setResponseStyle: (jobId: string, style: string) => void;
  setTone: (jobId: string, tone: string) => void;
  sendMessage: (jobId: string, question: string) => Promise<void>;
  clearChat: (jobId: string) => void;
}

const defaultSessionState: SessionChatState = {
  messages: [{
    id: "welcome",
    role: "assistant",
    content: "Hi! I'm your AI Mentor. I've analyzed this lecture and I'm ready to help you understand it deeply. What would you like to explore?"
  }],
  isTyping: false,
  typingStatus: null,
  error: null,
  responseStyle: "Standard",
  tone: "Friendly"
};

export const useTutorStore = create<TutorState>((set, get) => ({
  sessions: {},

  initSession: (jobId: string) => {
    set(state => {
      if (state.sessions[jobId]) return state; // Already exists
      return { sessions: { ...state.sessions, [jobId]: { ...defaultSessionState } } };
    });
  },

  setResponseStyle: (jobId: string, style: string) => {
    set(state => ({
      sessions: {
        ...state.sessions,
        [jobId]: { ...(state.sessions[jobId] || defaultSessionState), responseStyle: style }
      }
    }));
  },

  setTone: (jobId: string, tone: string) => {
    set(state => ({
      sessions: {
        ...state.sessions,
        [jobId]: { ...(state.sessions[jobId] || defaultSessionState), tone }
      }
    }));
  },

  sendMessage: async (jobId: string, question: string) => {
    const session = get().sessions[jobId] || defaultSessionState;
    
    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: question };
    
    set(state => ({
      sessions: {
        ...state.sessions,
        [jobId]: { 
          ...session, 
          messages: [...session.messages, userMsg], 
          isTyping: true, 
          typingStatus: "Analyzing lecture context...",
          error: null 
        }
      }
    }));

    // Simulate thinking stages for premium UX since we don't have streaming
    const thinkingStages = ["Searching relevant concepts...", "Generating response..."];
    let stageInterval: any;
    
    if (process.env.NEXT_PUBLIC_USE_MOCK_DATA !== 'true') {
        let stageIndex = 0;
        stageInterval = setInterval(() => {
          if (stageIndex < thinkingStages.length) {
            set(state => ({
              sessions: {
                ...state.sessions,
                [jobId]: { ...state.sessions[jobId], typingStatus: thinkingStages[stageIndex] }
              }
            }));
            stageIndex++;
          }
        }, 1500);
    }

    try {
      const combinedMode = `${session.responseStyle} - ${session.tone}`;
      const request: ChatRequest = { question, job_id: jobId, top_k: 3, mode: combinedMode };
      const data = await TutorService.sendMessage(request);
      
      const assistantMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: "assistant", 
        content: data.answer,
        sources: data.sources 
      };
      
      if (stageInterval) clearInterval(stageInterval);

      set(state => ({
        sessions: {
          ...state.sessions,
          [jobId]: { 
            ...state.sessions[jobId], 
            messages: [...state.sessions[jobId].messages, assistantMsg], 
            isTyping: false,
            typingStatus: null
          }
        }
      }));
    } catch (err: any) {
      if (stageInterval) clearInterval(stageInterval);
      set(state => ({
        sessions: {
          ...state.sessions,
          [jobId]: { 
            ...state.sessions[jobId], 
            error: err.message || "Failed to communicate with the AI Mentor.", 
            isTyping: false,
            typingStatus: null
          }
        }
      }));
    }
  },

  clearChat: (jobId: string) => {
    set(state => ({
      sessions: {
        ...state.sessions,
        [jobId]: { 
          ...defaultSessionState, 
          responseStyle: state.sessions[jobId]?.responseStyle || "Standard",
          tone: state.sessions[jobId]?.tone || "Friendly"
        }
      }
    }));
  }
}));
