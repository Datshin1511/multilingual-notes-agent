import { useEffect, useCallback, useRef } from 'react'
import { sessionsApi, transcribeApi, notesApi, metaApi } from '@/api/client'
import useStore from '@/store/useStore'
import type { SessionStatus } from '@/types'
import toast from 'react-hot-toast'

const POLL_MS = 3000
const DONE: SessionStatus[] = ['completed', 'failed']

// ─── Load all sessions + meta on mount ────────────────────────────────────────

export function useBootstrap() {
  const { setSessions, setMeta, setPredefinedTags } = useStore()

  const load = useCallback(async () => {
    try {
      const [sessRes, metaRes, tagsRes] = await Promise.all([
        sessionsApi.list(),
        metaApi.get(),
        metaApi.getTags(),
      ])
      setSessions(sessRes.data.sessions)
      setMeta(metaRes.data)
      setPredefinedTags(tagsRes.data.tags)
    } catch {
      toast.error('Failed to connect to backend')
    }
  }, [setSessions, setMeta, setPredefinedTags])

  useEffect(() => { void load() }, [load])
  return { reload: load }
}

// ─── Poll a single session until terminal ─────────────────────────────────────

export function useSessionPoller(sessionId?: string) {
  const { updateSession, setTranscript, setNotes, setProcessingStatus, processingStatus } = useStore()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const status = sessionId ? processingStatus[sessionId] : undefined

  const stop = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const poll = useCallback(async () => {
    if (!sessionId) return
    try {
      const { data: session } = await sessionsApi.get(sessionId)
      updateSession(sessionId, session)
      setProcessingStatus(sessionId, session.status)

      if (session.status === 'completed') {
        const [tRes, nRes] = await Promise.allSettled([
          transcribeApi.getTranscript(sessionId),
          notesApi.get(sessionId),
        ])
        if (tRes.status === 'fulfilled') setTranscript(sessionId, tRes.value.data)
        if (nRes.status === 'fulfilled') setNotes(sessionId, nRes.value.data)
        stop()
      } else if (session.status === 'failed') {
        toast.error(`Failed: ${session.error_message ?? 'Unknown error'}`)
        stop()
      }
    } catch { stop() }
  }, [sessionId, updateSession, setProcessingStatus, setTranscript, setNotes, stop])

  useEffect(() => {
    if (!sessionId || (status && DONE.includes(status))) return
    void poll()
    timerRef.current = setInterval(() => void poll(), POLL_MS)
    return stop
  }, [sessionId, status, poll, stop])
}

// ─── Load transcript + notes for a workspace ──────────────────────────────────

export function useWorkspace(sessionId?: string) {
  const { transcripts, notes, setTranscript, setNotes } = useStore()

  useEffect(() => {
    if (!sessionId) return
    void Promise.allSettled([
      transcribeApi.getTranscript(sessionId).then((r) => setTranscript(sessionId, r.data)),
      notesApi.get(sessionId).then((r) => setNotes(sessionId, r.data)),
    ])
  }, [sessionId, setTranscript, setNotes])

  return {
    transcript: sessionId ? transcripts[sessionId] : undefined,
    notes:      sessionId ? notes[sessionId]       : undefined,
  }
}