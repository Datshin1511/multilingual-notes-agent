import { useState } from 'react'
import { Edit3, Save, X, RefreshCw, Lightbulb, Target, Hash, Quote, FileText, type LucideIcon } from 'lucide-react'
import { notesApi } from '@/api/client'
import useStore from '@/store/useStore'
import type { Notes } from '@/types'
import toast from 'react-hot-toast'

function Section({ icon: Icon, title, accent = 'text-neon', children }: {
  icon: LucideIcon; title: string; accent?: string; children: React.ReactNode
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
        <Icon size={13} className={accent} />
        <span className="label">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

export default function NotesPanel({ notes, sessionId }: { notes?: Notes; sessionId: string }) {
  const { setNotes } = useStore()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [regen, setRegen] = useState(false)

  const save = async () => {
    try {
      const { data } = await notesApi.update(sessionId, { user_notes: draft })
      setNotes(sessionId, data); setEditing(false); toast.success('Saved')
    } catch { toast.error('Save failed') }
  }

  const regenerate = async () => {
    setRegen(true)
    try {
      const { data } = await notesApi.regenerate(sessionId)
      setNotes(sessionId, data); toast.success('Notes regenerated')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setRegen(false) }
  }

  if (!notes) return (
    <div className="flex items-center justify-center h-48 text-slate-600 text-sm">
      Notes will appear once processing completes.
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
        <span className="text-[11px] font-mono text-slate-600">
          via <span className="text-slate-400">{notes.generation_backend ?? 'rule-based'}</span>
        </span>
        <button onClick={() => void regenerate()} disabled={regen}
                className="btn-ghost py-1.5 px-3 text-xs gap-1.5">
          <RefreshCw size={11} className={regen ? 'animate-spin-slow' : ''} />
          Regenerate
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {/* Summary */}
        {notes.summary && (
          <Section icon={FileText} title="Summary" accent="text-ice">
            <p className="text-sm text-slate-300 leading-relaxed">{notes.summary}</p>
          </Section>
        )}

        {/* Key Points */}
        {notes.bullet_points.length > 0 && (
          <Section icon={Lightbulb} title="Key Points" accent="text-neon">
            <ul className="space-y-2">
              {notes.bullet_points.map((pt, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300
                                       animate-slide-in fill-both opacity-0"
                    style={{ animationDelay: `${i * 40}ms` }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-neon/50 mt-[7px] flex-shrink-0" />
                  {pt}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Topics */}
        {notes.key_topics.length > 0 && (
          <Section icon={Hash} title="Key Topics" accent="text-ember">
            <div className="flex flex-wrap gap-2">
              {notes.key_topics.map((t, i) => (
                <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium
                                         bg-ember/10 text-ember border border-ember/20
                                         animate-scale-in fill-both opacity-0"
                      style={{ animationDelay: `${i * 30}ms` }}>
                  {t}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Action items */}
        {notes.action_items.length > 0 && (
          <Section icon={Target} title="Action Items" accent="text-danger">
            <ul className="space-y-2">
              {notes.action_items.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <span className="w-4 h-4 rounded border border-danger/30 flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Quotes */}
        {notes.important_quotes.length > 0 && (
          <Section icon={Quote} title="Notable Quotes" accent="text-ice">
            <div className="space-y-2.5">
              {notes.important_quotes.map((q, i) => (
                <blockquote key={i} className="border-l-2 border-ice/30 pl-3 text-sm text-slate-400 italic leading-relaxed">
                  "{q}"
                </blockquote>
              ))}
            </div>
          </Section>
        )}

        {/* Personal notes */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Edit3 size={13} className="text-slate-500" />
              <span className="label">Personal Notes</span>
            </div>
            <div className="flex gap-1.5">
              {editing ? (
                <>
                  <button onClick={() => setEditing(false)} className="btn-icon w-6 h-6"><X size={12} /></button>
                  <button onClick={() => void save()} className="btn-primary py-1 px-2.5 text-xs">
                    <Save size={11} />Save
                  </button>
                </>
              ) : (
                <button onClick={() => { setDraft(notes.user_notes ?? ''); setEditing(true) }}
                        className="btn-icon w-6 h-6"><Edit3 size={12} /></button>
              )}
            </div>
          </div>
          <div className="p-4">
            {editing ? (
              <textarea className="textarea text-sm min-h-[90px]" autoFocus
                        placeholder="Your thoughts, follow-ups, context..."
                        value={draft} onChange={(e) => setDraft(e.target.value)} />
            ) : (
              <p className={`text-sm leading-relaxed ${notes.user_notes ? 'text-slate-300' : 'text-slate-600 italic'}`}>
                {notes.user_notes ?? 'Click the edit icon to add personal notes…'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}