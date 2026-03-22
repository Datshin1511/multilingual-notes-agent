import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Tag, Info, FileText, Mic2 } from 'lucide-react'
import { useSessionPoller, useWorkspace } from '@/hooks/useSession'
import useStore from '@/store/useStore'
import { sessionsApi } from '@/api/client'
import StatusBadge from '@/components/StatusBadge'
import NotesPanel from '@/components/NotesPanel'
import TranscriptPanel from '@/components/TranscriptPanel'
import TagManager from '@/components/TagManager'
import ExportModal from '@/components/ExportModal'

const STEPS = [
  { status: 'uploading',        label: 'Uploading audio',      n: 1 },
  { status: 'transcribing',     label: 'Transcribing (Whisper)',n: 2 },
  { status: 'translating',      label: 'Translating',          n: 3 },
  { status: 'generating_notes', label: 'Generating notes',     n: 4 },
]

export default function Session() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { sessions, activeTab, setActiveTab, exportOpen, setExportOpen, processingStatus, addSession } = useStore()

  const session = sessions.find((s) => s.id === id)
  const status = (id ? processingStatus[id] : undefined) ?? session?.status
  const { transcript, notes } = useWorkspace(id)
  useSessionPoller(id)

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

  const isProcessing = ['uploading','transcribing','translating','generating_notes'].includes(status ?? '')
  const isDone = status === 'completed'
  const curStep = STEPS.find((s) => s.status === status)?.n ?? 0

  return (
    <div className="min-h-screen bg-surface-950 bg-dot-grid flex flex-col">
      {/* Topbar */}
      <header className="glass-heavy border-b border-white/[0.07] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="btn-icon flex-shrink-0">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-body font-semibold text-white text-sm truncate">{session.name}</h1>
              {status && <StatusBadge status={status} />}
            </div>
          </div>
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
          {/* Tags */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Tag size={12} className="text-slate-500" />
              <span className="label">Tags</span>
            </div>
            <TagManager session={session} />
          </div>

          {/* Info */}
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
                    ? `${Math.floor(session.audio_duration_seconds/60)}m ${Math.floor(session.audio_duration_seconds%60)}s`
                    : undefined],
                ].filter(([,v]) => v).map(([k, v]) => (
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
              {/* Waveform */}
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
                  const done = n < curStep
                  const active = n === curStep
                  return (
                    <div key={n} className={`flex items-center gap-3 transition-all duration-300
                      ${active ? 'opacity-100' : done ? 'opacity-50' : 'opacity-20'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-mono font-semibold transition-all duration-300
                        ${done ? 'bg-neon text-surface-950'
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
              {status === 'failed' && (
                <div className="mt-8 p-4 rounded-xl bg-danger/5 border border-danger/20 text-center max-w-sm">
                  <p className="text-danger font-medium text-sm">Processing failed</p>
                  {session.error_message && <p className="text-slate-500 text-xs mt-1 font-mono">{session.error_message}</p>}
                </div>
              )}
            </div>
          ) : (
            <div className="card overflow-hidden flex flex-col" style={{ minHeight: '560px' }}>
              {/* Tabs */}
              <div className="flex items-center gap-1 px-5 pt-3 pb-0 border-b border-white/[0.06]">
                {[
                  { id: 'notes' as const,      label: 'Notes',      icon: FileText },
                  { id: 'transcript' as const, label: 'Transcript',  icon: Mic2 },
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

              {/* Panel */}
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