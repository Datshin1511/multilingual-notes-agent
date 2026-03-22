import { create } from 'zustand'
import type { Session, Transcript, Notes, SessionStatus, ActiveTab, MetadataResponse } from '@/types'

interface Store {
  // Sessions
  sessions: Session[]
  setSessions: (s: Session[]) => void
  addSession: (s: Session) => void
  removeSession: (id: string) => void
  updateSession: (id: string, patch: Partial<Session>) => void

  // Workspace
  transcripts: Record<string, Transcript>
  notes: Record<string, Notes>
  setTranscript: (id: string, t: Transcript) => void
  setNotes: (id: string, n: Notes) => void

  // Processing
  processingStatus: Record<string, SessionStatus>
  uploadProgress: Record<string, number>
  setProcessingStatus: (id: string, s: SessionStatus) => void
  setUploadProgress: (id: string, p: number) => void

  // Meta
  languages: MetadataResponse['languages']
  predefinedTags: string[]
  setMeta: (m: MetadataResponse) => void
  setPredefinedTags: (t: string[]) => void

  // UI
  activeTab: ActiveTab
  setActiveTab: (t: ActiveTab) => void
  newSessionOpen: boolean
  setNewSessionOpen: (v: boolean) => void
  exportOpen: boolean
  setExportOpen: (v: boolean) => void
}

const useStore = create<Store>((set) => ({
  // Sessions
  sessions: [],
  setSessions:   (sessions) => set({ sessions }),
  addSession:    (s) => set((st) => ({ sessions: [s, ...st.sessions] })),
  removeSession: (id) => set((st) => ({ sessions: st.sessions.filter((s) => s.id !== id) })),
  updateSession: (id, patch) =>
    set((st) => ({ sessions: st.sessions.map((s) => s.id === id ? { ...s, ...patch } : s) })),

  // Workspace
  transcripts: {},
  notes: {},
  setTranscript: (id, t) => set((st) => ({ transcripts: { ...st.transcripts, [id]: t } })),
  setNotes:      (id, n) => set((st) => ({ notes: { ...st.notes, [id]: n } })),

  // Processing
  processingStatus: {},
  uploadProgress: {},
  setProcessingStatus: (id, s) => set((st) => ({ processingStatus: { ...st.processingStatus, [id]: s } })),
  setUploadProgress:   (id, p) => set((st) => ({ uploadProgress:   { ...st.uploadProgress,   [id]: p } })),

  // Meta
  languages: [],
  predefinedTags: [],
  setMeta:          (m) => set({ languages: m.languages }),
  setPredefinedTags:(t) => set({ predefinedTags: t }),

  // UI
  activeTab: 'notes',
  setActiveTab:      (t) => set({ activeTab: t }),
  newSessionOpen: false,
  setNewSessionOpen: (v) => set({ newSessionOpen: v }),
  exportOpen: false,
  setExportOpen:     (v) => set({ exportOpen: v }),
}))

export default useStore