import { useState } from 'react'
import { Copy, Check, ChevronDown } from 'lucide-react'
import type { Transcript, Segment, Session } from '@/types'
import toast from 'react-hot-toast'

const LANG: Record<string, string> = {
  en:'English', fr:'French', de:'German', es:'Spanish', it:'Italian',
  pt:'Portuguese', nl:'Dutch', ru:'Russian', zh:'Chinese', ja:'Japanese',
  ko:'Korean', ar:'Arabic', hi:'Hindi', tr:'Turkish',
}

type View = 'translated' | 'original' | 'segments'

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setDone(true); toast.success('Copied')
    setTimeout(() => setDone(false), 2000)
  }
  return (
    <button onClick={() => void copy()} className="btn-ghost py-1.5 px-3 text-xs gap-1.5">
      {done ? <Check size={11} className="text-neon" /> : <Copy size={11} />}
      {done ? 'Copied' : 'Copy'}
    </button>
  )
}

function SegRow({ seg, showTrans }: { seg: Segment; showTrans: boolean }) {
  const [open, setOpen] = useState(false)
  const ts = `${String(Math.floor(seg.start / 60)).padStart(2,'0')}:${String(Math.floor(seg.start % 60)).padStart(2,'0')}`
  const hasTrans = showTrans && !!seg.translated_text && seg.translated_text !== seg.text

  return (
    <div className="border-b border-white/[0.04] last:border-0">
      <div className={`flex items-start gap-3 px-5 py-3 transition-colors
                       ${hasTrans ? 'cursor-pointer hover:bg-white/[0.02]' : ''}`}
           onClick={() => hasTrans && setOpen((o) => !o)}>
        <span className="font-mono text-[10px] text-slate-600 mt-0.5 w-10 flex-shrink-0 tabular-nums">{ts}</span>
        <p className="text-sm text-slate-300 flex-1 leading-relaxed">{seg.text}</p>
        {hasTrans && (
          <ChevronDown size={12} className={`text-slate-600 flex-shrink-0 mt-1 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        )}
      </div>
      {open && hasTrans && (
        <div className="px-5 pb-3 pl-[52px]">
          <p className="text-sm text-neon/70 leading-relaxed border-l-2 border-neon/20 pl-3 italic">
            {seg.translated_text}
          </p>
        </div>
      )}
    </div>
  )
}

interface Props { transcript?: Transcript; session?: Session }

export default function TranscriptPanel({ transcript, session }: Props) {
  const [view, setView] = useState<View>('translated')

  if (!transcript) return (
    <div className="flex items-center justify-center h-48 text-slate-600 text-sm">
      No transcript yet — upload audio to begin.
    </div>
  )

  const src = LANG[transcript.detected_language ?? ''] ?? transcript.detected_language?.toUpperCase() ?? '?'
  const tgt = LANG[session?.target_language ?? ''] ?? session?.target_language?.toUpperCase() ?? '?'
  const hasTrans = !!transcript.translated_text && transcript.translated_text !== transcript.raw_text
  const displayText = view === 'original' ? transcript.raw_text : (transcript.translated_text ?? transcript.raw_text)

  const VIEWS: { id: View; label: string; disabled?: boolean }[] = [
    { id: 'translated', label: `Translated (${tgt})`, disabled: !hasTrans },
    { id: 'original',   label: `Original (${src})` },
    { id: 'segments',   label: 'Segments' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Stats */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-white/[0.06] text-xs font-mono text-slate-500 flex-wrap">
        <span><span className="text-neon">{transcript.word_count?.toLocaleString()}</span> words</span>
        {transcript.detected_language_probability != null && (
          <span>Detected: <span className="text-slate-300">{src}</span>
            <span className="text-slate-700 ml-1">({(transcript.detected_language_probability * 100).toFixed(0)}%)</span>
          </span>
        )}
        {hasTrans && <span className="text-slate-600">→ <span className="text-slate-300">{tgt}</span></span>}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-5 py-2.5 border-b border-white/[0.06]">
        {VIEWS.map(({ id, label, disabled }) => (
          <button key={id} onClick={() => setView(id)} disabled={!!disabled}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
              ${view === id
                ? 'bg-neon/10 text-neon border border-neon/20'
                : 'text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed'}`}>
            {label}
          </button>
        ))}
        <div className="ml-auto"><CopyBtn text={displayText ?? ''} /></div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {view === 'segments' ? (
          transcript.segments.length > 0
            ? transcript.segments.map((s) => <SegRow key={s.id} seg={s} showTrans={hasTrans} />)
            : <p className="text-slate-600 text-sm p-5">No segments available.</p>
        ) : (
          <div className="p-5">
            <p className="text-sm text-slate-300 leading-[1.9] whitespace-pre-wrap">
              {displayText ?? <span className="text-slate-600 italic">No text.</span>}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}