// ─── Session ──────────────────────────────────────────────────────────────────

export type SessionStatus =
  | 'created'
  | 'uploading'
  | 'transcribing'
  | 'translating'
  | 'generating_notes'
  | 'completed'
  | 'failed'

export interface Session {
  id: string
  name: string
  description?: string
  model_size: string
  source_language?: string
  target_language: string
  status: SessionStatus
  error_message?: string
  audio_filename?: string
  audio_duration_seconds?: number
  tags: string[]
  created_at: string
  updated_at?: string
  completed_at?: string
}

export interface SessionCreate {
  name: string
  description?: string
  model_size: string
  target_language: string
  tags: string[]
}

export interface SessionUpdate {
  name?: string
  description?: string
  target_language?: string
  tags?: string[]
  user_notes?: string
}

export interface SessionListResponse {
  sessions: Session[]
  total: number
}

// ─── Transcript ────────────────────────────────────────────────────────────────

export interface Segment {
  id: number
  start: number
  end: number
  text: string
  translated_text?: string
}

export interface Transcript {
  id: string
  session_id: string
  raw_text?: string
  detected_language?: string
  detected_language_probability?: number
  translated_text?: string
  translation_model_used?: string
  segments: Segment[]
  word_count?: number
  duration_seconds?: number
  created_at: string
}

// ─── Notes ─────────────────────────────────────────────────────────────────────

export interface Notes {
  id: string
  session_id: string
  summary?: string
  bullet_points: string[]
  key_topics: string[]
  action_items: string[]
  important_quotes: string[]
  user_notes?: string
  generation_backend?: string
  created_at: string
  updated_at?: string
}

export interface NotesUpdate {
  user_notes?: string
  bullet_points?: string[]
  key_topics?: string[]
  action_items?: string[]
}

// ─── Export ─────────────────────────────────────────────────────────────────────

export interface ExportOptions {
  include_transcript: boolean
  include_translated: boolean
  include_notes: boolean
  include_segments: boolean
}

// ─── Meta ───────────────────────────────────────────────────────────────────────

export interface SupportedLanguage {
  code: string
  name: string
  native_name: string
}

export interface MetadataResponse {
  languages: SupportedLanguage[]
  whisper_models: WhisperModelMeta[]
  translation_backend: string
  notes_backend: string
}

export interface WhisperModelMeta {
  id: string
  name: string
  description: string
  recommended_device: string
  vram_required_gb?: number
}

// ─── UI ─────────────────────────────────────────────────────────────────────────

export type ActiveTab = 'notes' | 'transcript'