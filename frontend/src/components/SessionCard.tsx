import { useNavigate } from 'react-router-dom'
import { Mic2, Clock, Globe, Trash2, ArrowUpRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import StatusBadge from './StatusBadge'
import { sessionsApi } from '@/api/client'
import useStore from '@/store/useStore'
import type { Session } from '@/types'
import toast from 'react-hot-toast'

const LANG: Record<string, string> = {
  en:'English', fr:'French', de:'German', es:'Spanish', it:'Italian',
  pt:'Portuguese', nl:'Dutch', ru:'Russian', zh:'Chinese', ja:'Japanese',
  ko:'Korean', ar:'Arabic', hi:'Hindi', tr:'Turkish',
}

interface Props { session: Session; index: number }

export default function SessionCard({ session, index }: Props) {
  const navigate = useNavigate()
  const { removeSession } = useStore()

  const del = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Delete "${session.name}"?`)) return
    try {
      await sessionsApi.delete(session.id)
      removeSession(session.id)
      toast.success('Session deleted')
    } catch { toast.error('Delete failed') }
  }

  const dur = session.audio_duration_seconds
    ? `${Math.floor(session.audio_duration_seconds / 60)}m ${Math.floor(session.audio_duration_seconds % 60)}s`
    : null

  const delay = `${index * 60}ms`

  return (
    <div
      onClick={() => navigate(`/session/${session.id}`)}
      style={{ animationDelay: delay }}
      className="card-interactive group relative p-5 animate-slide-up fill-both opacity-0"
    >
      {/* Left accent bar */}
      <div className="absolute left-0 top-4 bottom-4 w-[2px] rounded-r-full bg-neon
                      scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-center" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-surface-700 border border-white/[0.07]
                          flex items-center justify-center flex-shrink-0
                          group-hover:border-neon/20 group-hover:bg-neon/5 transition-all duration-300">
            <Mic2 size={14} className="text-slate-500 group-hover:text-neon transition-colors duration-300" />
          </div>
          <div className="min-w-0">
            <h3 className="font-body font-semibold text-slate-100 group-hover:text-white truncate text-sm leading-snug">
              {session.name}
            </h3>
            {session.description && (
              <p className="text-xs text-slate-600 truncate mt-0.5">{session.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <StatusBadge status={session.status} />
          <button
            onClick={del}
            className="btn-icon opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md text-slate-600 hover:text-danger hover:bg-danger/10"
          >
            <Trash2 size={12} />
          </button>
          <div className="btn-icon w-6 h-6 rounded-md opacity-0 group-hover:opacity-100 text-slate-600 group-hover:text-neon">
            <ArrowUpRight size={13} />
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 text-[11px] text-slate-600 font-mono">
        {dur && <span className="flex items-center gap-1"><Clock size={10} />{dur}</span>}
        {session.target_language && (
          <span className="flex items-center gap-1">
            <Globe size={10} />
            {LANG[session.target_language] ?? session.target_language.toUpperCase()}
          </span>
        )}
        <span className="ml-auto">
          {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
        </span>
      </div>

      {/* Tags */}
      {session.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {session.tags.slice(0, 4).map((t) => (
            <span key={t} className="tag text-[10px] px-2 py-0.5 pointer-events-none">{t}</span>
          ))}
          {session.tags.length > 4 && (
            <span className="text-[10px] text-slate-700 self-center">+{session.tags.length - 4}</span>
          )}
        </div>
      )}
    </div>
  )
}