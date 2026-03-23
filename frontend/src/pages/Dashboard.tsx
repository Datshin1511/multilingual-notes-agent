import { useState } from 'react'
import { Plus, Search, Mic2, CheckCircle2, Loader2 } from 'lucide-react'
import { useBootstrap } from '@/hooks/useSession'
import useStore from '@/store/useStore'
import SessionCard from '@/components/SessionCard'
import NewSessionModal from '@/components/NewSessionModal'

export default function Dashboard() {
  const { sessions, newSessionOpen, setNewSessionOpen } = useStore()
  useBootstrap()

  const [search, setSearch] = useState('')
  const [tag, setTag] = useState<string | null>(null)

  const allTags = [...new Set(sessions.flatMap((s) => s.tags))]
  const filtered = sessions.filter((s) => {
    const q = search.toLowerCase()
    return (!q || s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q))
      && (!tag || s.tags.includes(tag))
  })

  const completed = sessions.filter((s) => s.status === 'completed').length
  const processing = sessions.filter((s) => ['transcribing','translating','generating_notes'].includes(s.status)).length

  return (
    <div className="min-h-screen bg-surface-950 bg-dot-grid bg-dot-grid">
      {/* Navbar */}
      <header className="glass-heavy border-b border-white/[0.07] sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-neon flex items-center justify-center">
              <Mic2 size={14} className="text-surface-950" />
            </div>
            <span className="font-body font-semibold text-white">Verbatim</span>
            <span className="text-[10px] font-mono text-slate-600 hidden sm:block">/ multilingual notes</span>
          </div>
          <button onClick={() => setNewSessionOpen(true)} className="btn-primary py-2 px-4 text-sm">
            <Plus size={15} />New Session
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {sessions.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="relative mb-8">
              <div className="w-20 h-20 rounded-2xl bg-surface-800 border border-white/[0.07] flex items-center justify-center">
                <Mic2 size={32} className="text-neon" />
              </div>
              <div className="absolute -inset-3 rounded-full border border-neon/10 animate-pulse" />
            </div>
            <h1 className="font-body font-bold text-3xl text-white mb-3">
              Audio → <span className="text-gradient">structured notes</span>
            </h1>
            <p className="text-slate-500 max-w-sm mb-8 leading-relaxed text-sm">
              Upload any audio — meetings, podcasts, interviews — get precise transcriptions, translations, and AI notes.
            </p>
            <button onClick={() => setNewSessionOpen(true)} className="btn-primary px-7 py-3">
              <Plus size={16} />Create First Session
            </button>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[
                { label: 'Sessions', value: sessions.length, icon: Mic2,        color: 'text-slate-300' },
                { label: 'Completed',value: completed,       icon: CheckCircle2, color: 'text-neon' },
                { label: 'Processing',value: processing,     icon: Loader2,      color: 'text-ember' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="card p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon size={11} className={color} />
                    <span className="label">{label}</span>
                  </div>
                  <div className={`font-body font-bold text-2xl ${color}`}>{value}</div>
                </div>
              ))}
            </div>

            {/* Search + tag filter */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                <input className="input pl-9 py-2.5" placeholder="Search sessions…"
                       value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {allTags.slice(0,6).map((t) => (
                <button key={t} onClick={() => setTag(tag === t ? null : t)}
                  className={`tag-btn text-xs ${tag === t ? 'tag-active' : ''}`}>{t}</button>
              ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map((s, i) => <SessionCard key={s.id} session={s} index={i} />)}
              {filtered.length === 0 && (
                <p className="col-span-2 text-center py-12 text-slate-600 text-sm">No sessions match.</p>
              )}
            </div>
          </>
        )}
      </main>

      {newSessionOpen && <NewSessionModal onClose={() => setNewSessionOpen(false)} />}
    </div>
  )
}