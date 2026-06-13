// Backend Enum Equivalents
export type JobStatus = "pending" | "processing" | "completed" | "failed";
export type SessionStatus = "active" | "stopped" | "processing" | "completed" | "failed";
export type NotesMode = "easy" | "standard" | "deep" | "as_is" | "exam";

// ==========================================
// 1. Transcript Schemas
// ==========================================
export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptMetadata {
  job_id: string;
  source_filename: string;
  model: string;
  language?: string;
}

export interface TranscriptPayload {
  metadata: TranscriptMetadata;
  segments: TranscriptSegment[];
}

// ==========================================
// 2. Job / Session Schemas
// ==========================================
export interface JobCreateResponse {
  job_id: string;
  status: JobStatus;
  message: string;
  created_at?: string;
}

export interface JobDetailResponse {
  job_id: string;
  status: JobStatus;
  source_filename?: string;
  error_message?: string;
  created_at?: string;
  progress_stage?: string;
  transcript_path?: string;
  transcript?: TranscriptPayload;
  ocr_results?: any[]; // Keep any[] for now as per backend OCR dict
  chunks?: any[];
}

// ==========================================
// 3. Live Session Schemas
// ==========================================
export interface LiveSessionCreate {
  title: string;
}

export interface LiveSessionResponse {
  session_id: string;
  title: string;
  created_at: string;
  status: SessionStatus;
  screenshot_count: number;
  audio_chunks_count: number;
  message?: string;
}

export interface LiveSessionDetail extends LiveSessionResponse {
  processing_state?: string;
  error_message?: string;
}

// ==========================================
// 4. Intelligence Schemas (Notes)
// ==========================================
export interface NotesRequest {
  session_id: string;
  mode: NotesMode;
}

export interface NotesResponse {
  session_id: string;
  title: string;
  mode: NotesMode;
  content: string; // Markdown content
  key_concepts: string[];
  citations: any[];
}

// ==========================================
// 5. Chat / Tutor Schemas
// ==========================================
export interface ChatRequest {
  question: string;
  job_id?: string;
  top_k: number;
  mode: string;
}

export interface RetrievedSource {
  chunk_id: string;
  score: number;
  spoken_text: string;
  slide_text?: string;
  screenshots: string[];
  start_time: number;
  end_time: number;
}

export interface ChatResponse {
  answer: string;
  sources: RetrievedSource[];
}
