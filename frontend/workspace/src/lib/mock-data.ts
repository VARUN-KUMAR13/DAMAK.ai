import { 
  JobDetailResponse, 
  JobCreateResponse, 
  NotesResponse, 
  ChatResponse, 
  LiveSessionDetail 
} from './api-types';

export const MockData = {
  jobs: [
    {
      job_id: "mock-job-1234",
      status: "completed",
      source_filename: "Advanced Distributed Systems Lecture.mp4",
      created_at: new Date(Date.now() - 86400000).toISOString(),
      progress_stage: "Done",
      transcript_path: "/mock/transcript.json",
    },
    {
      job_id: "mock-job-5678",
      status: "processing",
      source_filename: "Introduction to FastAPI.mp4",
      created_at: new Date().toISOString(),
      progress_stage: "Generating Notes...",
    }
  ] as JobDetailResponse[],

  uploadJob: {
    job_id: "mock-new-job",
    status: "pending",
    message: "Upload accepted.",
  } as JobCreateResponse,

  notes: {
    session_id: "mock-job-1234",
    title: "Advanced Distributed Systems",
    mode: "standard",
    content: "# Key Takeaways\n- CAP Theorem states you can only have two of Consistency, Availability, Partition Tolerance.\n- CP systems halt writes during partitions.\n- AP systems return stale data.",
    key_concepts: ["CAP Theorem", "Eventual Consistency"],
    citations: []
  } as NotesResponse,

  chat: {
    answer: "Based on the lecture, a CP system maintains consistency by refusing writes if a partition occurs.",
    sources: [
      {
        chunk_id: "chunk-1",
        score: 0.95,
        spoken_text: "In a CP system, we halt writes...",
        screenshots: [],
        start_time: 12.5,
        end_time: 20.0
      }
    ]
  } as ChatResponse,

  liveSessionStart: {
    session_id: "mock-live-1",
    title: "Mock Live Session",
    created_at: new Date().toISOString(),
    status: "active",
    screenshot_count: 0,
    audio_chunks_count: 0,
  } as LiveSessionDetail,

  liveSessionStop: {
    session_id: "mock-live-1",
    title: "Mock Live Session",
    created_at: new Date().toISOString(),
    status: "processing",
    screenshot_count: 5,
    audio_chunks_count: 12,
  } as LiveSessionDetail
};
