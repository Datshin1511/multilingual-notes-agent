import axios, { type AxiosProgressEvent } from 'axios'
import type {
  Session, SessionCreate, SessionUpdate, SessionListResponse,
  Transcript, Notes, NotesUpdate, ExportOptions, MetadataResponse,
} from '@/types'

const http = axios.create({
  baseURL: '/api',
  timeout: 300_000,
})

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = (err.response?.data?.detail as string) ?? err.message ?? 'Request failed'
    return Promise.reject(new Error(msg))
  }
)

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const sessionsApi = {
  list: ()                           => http.get<SessionListResponse>('/sessions'),
  get:  (id: string)                 => http.get<Session>(`/sessions/${id}`),
  create: (d: SessionCreate)         => http.post<Session>('/sessions', d),
  update: (id: string, d: SessionUpdate) => http.patch<Session>(`/sessions/${id}`, d),
  delete: (id: string)               => http.delete(`/sessions/${id}`),
}

// ─── Transcribe ───────────────────────────────────────────────────────────────

export const transcribeApi = {
  upload: (sessionId: string, file: File, onProgress?: (pct: number) => void) => {
    const form = new FormData()
    form.append('file', file)
    return http.post(`/transcribe/${sessionId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e: AxiosProgressEvent) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total))
      },
    })
  },
  getTranscript: (id: string) => http.get<Transcript>(`/transcribe/${id}`),
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export const notesApi = {
  get:        (id: string)                => http.get<Notes>(`/notes/${id}`),
  update:     (id: string, d: NotesUpdate) => http.patch<Notes>(`/notes/${id}`, d),
  regenerate: (id: string)               => http.post<Notes>(`/notes/${id}/regenerate`),
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const exportApi = {
  pdf: async (id: string, opts: Partial<ExportOptions> = {}): Promise<Blob> => {
    const res = await http.post(`/export/${id}/pdf`, opts, { responseType: 'blob' })
    return res.data as Blob
  },
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

export const metaApi = {
  get:     () => http.get<MetadataResponse>('/meta'),
  getTags: () => http.get<{ tags: string[] }>('/meta/tags'),
}