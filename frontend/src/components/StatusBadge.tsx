import type { SessionStatus } from '@/types'

interface Cfg { label: string; cls: string; dot?: boolean }

const MAP: Record<SessionStatus, Cfg> = {
  created:          { label: 'Created',          cls: 'text-slate-400 border-slate-700 bg-slate-800/40' },
  uploading:        { label: 'Uploading',         cls: 'text-ice border-ice/20 bg-ice/5',      dot: true },
  transcribing:     { label: 'Transcribing',      cls: 'text-neon border-neon/20 bg-neon/5',   dot: true },
  translating:      { label: 'Translating',       cls: 'text-ember border-ember/20 bg-ember/5', dot: true },
  generating_notes: { label: 'Generating Notes',  cls: 'text-ice border-ice/20 bg-ice/5',      dot: true },
  completed:        { label: 'Completed',         cls: 'text-neon border-neon/20 bg-neon/5' },
  failed:           { label: 'Failed',            cls: 'text-danger border-danger/20 bg-danger/5' },
}

export default function StatusBadge({ status }: { status: SessionStatus }) {
  const cfg = MAP[status] ?? MAP.created
  return (
    <span className={`badge ${cfg.cls}`}>
      {cfg.dot ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-60" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
        </span>
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
      )}
      {cfg.label}
    </span>
  )
}