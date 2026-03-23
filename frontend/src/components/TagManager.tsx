import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { sessionsApi } from '@/api/client'
import useStore from '@/store/useStore'
import type { Session } from '@/types'
import toast from 'react-hot-toast'

const PRESETS = ['meeting','podcast','interview','lecture','call','conference','personal','research','news','tutorial']

export default function TagManager({ session }: { session: Session }) {
  const { updateSession } = useStore()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const tags = session.tags ?? []

  const persist = async (next: string[]) => {
    setBusy(true)
    try {
      await sessionsApi.update(session.id, { tags: next })
      updateSession(session.id, { tags: next })
    } catch { toast.error('Failed') }
    finally { setBusy(false) }
  }

  const add = (t: string) => {
    const clean = t.trim().toLowerCase()
    if (clean && !tags.includes(clean)) void persist([...tags, clean])
    setInput('')
  }

  const remove = (t: string) => void persist(tags.filter((x) => x !== t))

  return (
    <div className="space-y-3">
      {/* Current */}
      <div className="flex flex-wrap gap-1.5 min-h-[26px]">
        {tags.length === 0
          ? <span className="text-xs text-slate-700 italic">No tags</span>
          : tags.map((t) => (
              <span key={t} className="tag tag-active text-[11px] group">
                {t}
                <button title="remove" onClick={() => remove(t)} disabled={busy}
                        className="opacity-60 group-hover:opacity-100 transition-opacity">
                  <X size={9} />
                </button>
              </span>
            ))
        }
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input className="input py-2 text-xs flex-1" placeholder="Add tag…"
               value={input} onChange={(e) => setInput(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && add(input)} disabled={busy} />
        <button title="add" onClick={() => add(input)} disabled={busy || !input.trim()}
                className="btn-ghost py-2 px-3"><Plus size={13} /></button>
      </div>

      {/* Suggestions */}
      {PRESETS.filter((t) => !tags.includes(t)).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {PRESETS.filter((t) => !tags.includes(t)).slice(0, 6).map((t) => (
            <button key={t} onClick={() => add(t)} className="tag-btn text-[10px] px-2 py-0.5 gap-1">
              <Plus size={8} />{t}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}