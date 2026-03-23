import { useState } from 'react'
import { X, Download, FileText, Loader2 } from 'lucide-react'
import { exportApi } from '@/api/client'
import type { Session, ExportOptions } from '@/types'
import toast from 'react-hot-toast'

const OPTIONS: { key: keyof ExportOptions; label: string; desc: string }[] = [
  { key: 'include_notes',      label: 'Notes',                desc: 'Summary, key points, action items, quotes' },
  { key: 'include_transcript', label: 'Original Transcript',  desc: 'Raw transcribed text' },
  { key: 'include_translated', label: 'Translation',          desc: 'Text translated into target language' },
  { key: 'include_segments',   label: 'Timestamped Segments', desc: 'Full segment-by-segment breakdown' },
]

export default function ExportModal({ session, onClose }: { session: Session; onClose: () => void }) {
  const [opts, setOpts] = useState<ExportOptions>({
    include_notes: true, include_transcript: true,
    include_translated: true, include_segments: false,
  })
  const [busy, setBusy] = useState(false)

  const toggle = (k: keyof ExportOptions) => setOpts((o) => ({ ...o, [k]: !o[k] }))

  const download = async () => {
    setBusy(true)
    try {
      const blob = await exportApi.pdf(session.id, opts)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${session.name.replace(/\s+/g,'_')}_notes.pdf`
      a.click(); URL.revokeObjectURL(url)
      toast.success('PDF downloaded'); onClose()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Export failed') }
    finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
         onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div onClick={(e) => e.stopPropagation()}
           className="relative w-full sm:max-w-md glass-heavy rounded-t-3xl sm:rounded-2xl overflow-hidden animate-scale-in">

        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-neon/10 border border-neon/20 flex items-center justify-center">
              <FileText size={14} className="text-neon" />
            </div>
            <div>
              <h3 className="font-body font-semibold text-white text-sm">Export PDF</h3>
              <p className="text-[11px] text-slate-500 truncate max-w-[200px]">{session.name}</p>
            </div>
          </div>
          <button title = "close" onClick={onClose} className="btn-icon"><X size={16} /></button>
        </div>

        <div className="px-5 py-4 space-y-2">
          <p className="label mb-3">Include in export</p>
          {OPTIONS.map(({ key, label, desc }) => (
            <button key={key} onClick={() => toggle(key)}
              className={`w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all duration-200
                ${opts[key]
                  ? 'border-neon/25 bg-neon/[0.05]'
                  : 'border-white/[0.07] bg-surface-800 hover:border-white/[0.12]'}`}>
              <div className={`w-4 h-4 rounded-md border mt-0.5 flex-shrink-0 flex items-center justify-center transition-all duration-200
                              ${opts[key] ? 'border-neon bg-neon' : 'border-white/20'}`}>
                {opts[key] && <Check />}
              </div>
              <div>
                <p className={`text-sm font-medium ${opts[key] ? 'text-white' : 'text-slate-400'}`}>{label}</p>
                <p className="text-xs text-slate-600 mt-0.5">{desc}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="px-5 pb-5">
          <button onClick={() => void download()} disabled={busy} className="btn-primary w-full py-3">
            {busy
              ? <><Loader2 size={14} className="animate-spin-slow" />Generating…</>
              : <><Download size={14} />Download PDF</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function Check() {
  return (
    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
      <path d="M1 4L3.5 6.5L9 1" stroke="#06080F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}