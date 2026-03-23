import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Tag, Info, FileText, Mic2, Clock } from 'lucide-react'
import { useSessionPoller, useWorkspace } from '@/hooks/useSession'
import useStore from '@/store/useStore'
import { sessionsApi } from '@/api/client'
import StatusBadge from '@/components/StatusBadge'
import NotesPanel from '@/components/NotesPanel'
import TranscriptPanel from '@/components/TranscriptPanel'
import TagManager from '@/components/TagManager'
import ExportModal from '@/components/ExportModal'

// ── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { status: 'uploading',        label: 'Uploading audio',        n: 1 },
  { status: 'transcribing',     label: 'Transcribing (Whisper)', n: 2 },
  { status: 'translating',      label: 'Translating',            n: 3 },
  { status: 'generating_notes', label: 'Generating notes',       n: 4 },
]

// Static estimate per step (seconds). Used as the initial prediction.
const STEP_ESTIMATES: Record<string, number> = {
  uploading:        10,
  transcribing:     60,
  translating:      30,
  generating_notes: 20,
}

const PROCESSING_STATUSES = new Set(['uploading', 'transcribing', 'translating', 'generating_notes'])

// EMA smoothing factor — higher = reacts faster to reality (0.15 is Windows-like)
const EMA_ALPHA = 0.15

// ── Helpers ──────────────────────────────────────────────────────────────────

function totalEstimate(): number {
  return STEPS.reduce((acc, s) => acc + (STEP_ESTIMATES[s.status] ?? 0), 0)
}

function stepsRemainingEstimate(fromStep: number): number {
  return STEPS.slice(fromStep - 1).reduce(
    (acc, s) => acc + (STEP_ESTIMATES[s.status] ?? 0),
    0,
  )
}

function formatTime(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  const rem = s % 60
  return m > 0 ? `${m}m ${rem.toString().padStart(2, '0')}s` : `${rem}s`
}

// sessionStorage key scoped to session id
const startKey = (id: string) => `proc_start_${id}`

/**
 * Returns a stable processing-start timestamp (ms) for this session.
 * Stamped on first call, reused on re-renders / page refreshes.
 * Cleared when processing ends so the next run starts fresh.
 */
function getOrStampStart(id: string): number {
  const key    = startKey(id)
  const stored = sessionStorage.getItem(key)
  if (stored) return parseInt(stored, 10)
  const now = Date.now()
  sessionStorage.setItem(key, String(now))
  return now
}

function clearStart(id: string) {
  sessionStorage.removeItem(startKey(id))
}

// ── TimeDisplay ───────────────────────────────────────────────────────────────

function TimeDisplay({
  elapsedSec,
  etaSec,
  curStep,
}: {
  elapsedSec: number
  etaSec: number        // smoothed remaining seconds (Windows-style EMA)
  curStep: number
}) {
  const total    = totalEstimate()
  const doneSec  = total - stepsRemainingEstimate(curStep)
  const stepEst  = STEP_ESTIMATES[STEPS[curStep - 1]?.status] ?? 60
  const progress = Math.min(1, (doneSec + Math.min(elapsedSec, stepEst)) / total)
  const overdue  = etaSec <= 0

  const barColor = overdue ? 'from-orange-500 to-red-500' : 'from-neon/80 to-neon'

  return (
    <div className="mt-10 w-full max-w-xs">
      {/* Progress bar */}
      <div className="relative h-1 w-full rounded-full bg-white/[0.06] overflow-hidden mb-4">
        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${barColor} transition-all duration-1000 ease-linear`}
          style={{ width: `${progress * 100}%` }}
        />
        {!overdue && (
          <div
            className="absolute inset-y-0 w-4 rounded-full bg-neon/60 blur-sm transition-all duration-1000 ease-linear"
            style={{ left: `calc(${progress * 100}% - 8px)` }}
          />
        )}
      </div>

      {/* Three stat pills */}
      <div className="grid grid-cols-3 gap-2">
        {/* Elapsed */}
        <div className="flex flex-col items-center gap-0.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-2 py-2.5">
          <span className="text-[10px] uppercase tracking-widest text-slate-600 font-medium">Elapsed</span>
          <span className="font-mono text-sm font-semibold text-slate-200 tabular-nums">
            {formatTime(elapsedSec)}
          </span>
        </div>

        {/* ETA / Overdue */}
        <div className="flex flex-col items-center gap-0.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-2 py-2.5">
          <span className="text-[10px] uppercase tracking-widest text-slate-600 font-medium">
            {overdue ? 'Overdue' : 'Left'}
          </span>
          <span className={`font-mono text-sm font-semibold tabular-nums ${overdue ? 'text-orange-400' : 'text-slate-200'}`}>
            {overdue
              ? `+${formatTime(Math.abs(etaSec))}`
              : formatTime(etaSec)}
          </span>
        </div>

        {/* Total estimate */}
        <div className="flex flex-col items-center gap-0.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-2 py-2.5">
          <span className="text-[10px] uppercase tracking-widest text-slate-600 font-medium">Total est.</span>
          <span className="font-mono text-sm font-semibold text-slate-200 tabular-nums">
            ~{formatTime(total)}
          </span>
        </div>
      </div>

      {/* Step fraction */}
      {curStep > 0 && (
        <p className="mt-3 text-center text-[11px] text-slate-600">
          Step <span className="font-mono text-slate-400">{curStep}</span>
          {' '}of <span className="font-mono text-slate-400">{STEPS.length}</span>
        </p>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function Session() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    sessions, activeTab, setActiveTab,
    exportOpen, setExportOpen,
    processingStatus, addSession,
  } = useStore()

  const session = sessions.find((s) => s.id === id)
  const status  = (id ? processingStatus[id] : undefined) ?? session?.status
  const { transcript, notes } = useWorkspace(id)
  useSessionPoller(id)

  const isProcessing = PROCESSING_STATUSES.has(status ?? '')
  const isDone       = status === 'completed'
  const curStep      = STEPS.find((s) => s.status === status)?.n ?? 0

  // ── Processing-start stamp ────────────────────────────────────────────────
  // Written to sessionStorage the moment isProcessing first becomes true.
  // Survives page refresh. Cleared on completion so the next upload starts at 0.
  const processingStartRef = useRef<number | null>(null)

  useEffect(() => {
    if (!id) return
    if (isProcessing) {
      processingStartRef.current = getOrStampStart(id)
    } else {
      clearStart(id)
      processingStartRef.current = null
    }
  }, [id, isProcessing])

  // ── EMA-smoothed ETA (Windows-style) ─────────────────────────────────────
  // Initial value = static remaining estimate.
  // Every second, blends "actual observed remaining" with the running average.
  // EMA_ALPHA = 0.15 → slow, stable updates (same feel as Windows copy dialog).
  const emaEtaRef = useRef<number | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [etaSec,     setEtaSec]     = useState(stepsRemainingEstimate(1))

  useEffect(() => {
    if (!isProcessing) {
      emaEtaRef.current = null
      setElapsedSec(0)
      setEtaSec(stepsRemainingEstimate(1))
      return
    }

    const iv = setInterval(() => {
      const start = processingStartRef.current
      if (!start) return

      const elapsed = Math.floor((Date.now() - start) / 1000)
      setElapsedSec(elapsed)

      // How long we've been in the current step (capped to avoid runaway)
      const stepEst     = STEP_ESTIMATES[STEPS[curStep - 1]?.status] ?? 60
      const stepElapsed = Math.min(elapsed, stepEst + 30)

      // Observed remaining = how much of this step is left + all future steps
      const realRemaining =
        Math.max(0, stepEst - stepElapsed) +
        stepsRemainingEstimate(curStep + 1)

      // Initialise EMA on first tick
      if (emaEtaRef.current === null) {
        emaEtaRef.current = stepsRemainingEstimate(curStep)
      }

      // Exponential moving average
      emaEtaRef.current =
        EMA_ALPHA * realRemaining + (1 - EMA_ALPHA) * emaEtaRef.current

      setEtaSec(Math.round(emaEtaRef.current))
    }, 1000)

    return () => clearInterval(iv)
  // curStep intentionally in deps — EMA re-anchors when step advances
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProcessing, curStep])

  // ── Fetch session if missing ──────────────────────────────────────────────
  useEffect(() => {
    if (!session && id) {
      sessionsApi.get(id)
        .then((r) => addSession(r.data))
        .catch(() => navigate('/'))
    }
  }, [id, session, addSession, navigate])

  if (!session) return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center">
      <div className="flex items-end gap-1 h-8">
        {[...Array(7)].map((_, i) => <div key={i} className="wave-bar" />)}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-surface-950 bg-dot-grid flex flex-col">

      {/* Topbar */}
      <header className="glass-heavy border-b border-white/[0.07] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center gap-3">
          <button title="navigate" onClick={() => navigate('/')} className="btn-icon flex-shrink-0">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-body font-semibold text-white text-sm truncate">{session.name}</h1>
              {status && <StatusBadge status={status} />}
            </div>
          </div>

          {isProcessing && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 font-mono">
              <Clock size={11} className="text-neon/60" />
              <span className="text-neon/80">{formatTime(elapsedSec)}</span>
              <span>/</span>
              <span>~{formatTime(etaSec)} left</span>
            </div>
          )}
          {isDone && (
            <button onClick={() => setExportOpen(true)} className="btn-primary py-1.5 px-4 text-sm flex-shrink-0">
              <Download size={13} />Export PDF
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full px-5 py-6 flex flex-col lg:flex-row gap-5">

        {/* Sidebar */}
        <aside className="lg:w-60 xl:w-64 flex-shrink-0 space-y-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Tag size={12} className="text-slate-500" />
              <span className="label">Tags</span>
            </div>
            <TagManager session={session} />
          </div>

          {(transcript || session.audio_filename) && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Info size={12} className="text-slate-500" />
                <span className="label">Audio Info</span>
              </div>
              <dl className="space-y-1.5">
                {[
                  ['File',     session.audio_filename],
                  ['Model',    session.model_size],
                  ['Detected', transcript?.detected_language?.toUpperCase()],
                  ['Words',    transcript?.word_count?.toLocaleString()],
                  ['Duration', session.audio_duration_seconds
                    ? `${Math.floor(session.audio_duration_seconds / 60)}m ${Math.floor(session.audio_duration_seconds % 60)}s`
                    : undefined],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k as string} className="flex justify-between text-xs">
                    <dt className="text-slate-600">{k}</dt>
                    <dd className="text-slate-300 font-mono truncate ml-2">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </aside>

        {/* Main panel */}
        <main className="flex-1 min-w-0">
          {isProcessing ? (
            <div className="card flex flex-col items-center justify-center py-20 px-8 text-center">
              <div className="flex items-end gap-1 h-10 mb-8">
                {[...Array(7)].map((_, i) => <div key={i} className="wave-bar" />)}
              </div>
              <h2 className="font-body font-semibold text-white text-lg mb-1">Processing audio…</h2>
              <p className="text-slate-500 text-sm mb-10">
                {STEPS.find((s) => s.status === status)?.label ?? 'Working…'}
              </p>

              {/* Step progress */}
              <div className="w-full max-w-xs space-y-3">
                {STEPS.map(({ label, n }) => {
                  const done   = n < curStep
                  const active = n === curStep
                  return (
                    <div key={n} className={`flex items-center gap-3 transition-all duration-300
                      ${active ? 'opacity-100' : done ? 'opacity-50' : 'opacity-20'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-mono font-semibold transition-all duration-300
                        ${done   ? 'bg-neon text-surface-950'
                        : active ? 'border-2 border-neon text-neon bg-neon/10'
                                 : 'border border-white/10 text-slate-600'}`}>
                        {done ? '✓' : active
                          ? <span className="w-2 h-2 border-2 border-neon border-t-transparent rounded-full animate-spin-slow" />
                          : n}
                      </div>
                      <span className={`text-sm ${active ? 'text-neon font-medium' : done ? 'text-slate-400' : 'text-slate-600'}`}>
                        {label}
                      </span>
                    </div>
                  )
                })}
              </div>

              <TimeDisplay
                elapsedSec={elapsedSec}
                etaSec={etaSec}
                curStep={curStep}
              />

              {status === 'failed' && (
                <div className="mt-8 p-4 rounded-xl bg-danger/5 border border-danger/20 text-center max-w-sm">
                  <p className="text-danger font-medium text-sm">Processing failed</p>
                  {session.error_message && (
                    <p className="text-slate-500 text-xs mt-1 font-mono">{session.error_message}</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="card overflow-hidden flex flex-col" style={{ minHeight: '560px' }}>
              <div className="flex items-center gap-1 px-5 pt-3 pb-0 border-b border-white/[0.06]">
                {[
                  { id: 'notes'      as const, label: 'Notes',      icon: FileText },
                  { id: 'transcript' as const, label: 'Transcript',  icon: Mic2    },
                ].map(({ id: tid, label, icon: Icon }) => (
                  <button key={tid} onClick={() => setActiveTab(tid)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg
                                border-b-2 -mb-px transition-all duration-200
                      ${activeTab === tid
                        ? 'border-neon text-neon'
                        : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                    <Icon size={13} />{label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-hidden">
                {activeTab === 'notes'
                  ? <NotesPanel notes={notes} sessionId={id ?? ''} />
                  : <TranscriptPanel transcript={transcript} session={session} />}
              </div>
            </div>
          )}
        </main>
      </div>

      {exportOpen && <ExportModal session={session} onClose={() => setExportOpen(false)} />}
    </div>
  )
}