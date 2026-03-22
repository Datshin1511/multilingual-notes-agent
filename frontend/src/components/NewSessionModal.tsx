import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { X, Upload, Mic2, Check, ChevronDown, Cpu, Globe, Tag } from 'lucide-react'
import { sessionsApi, transcribeApi } from '@/api/client'
import useStore from '@/store/useStore'
import toast from 'react-hot-toast'

const MODELS = [
  { id: 'tiny',     label: 'Tiny',     desc: 'Fastest · lowest accuracy',  device: 'CPU' },
  { id: 'base',     label: 'Base',     desc: 'Fast · decent accuracy',      device: 'CPU' },
  { id: 'small',    label: 'Small',    desc: 'Balanced · recommended',      device: 'CPU', rec: true },
  { id: 'medium',   label: 'Medium',   desc: 'High accuracy · slow CPU',    device: 'GPU' },
  { id: 'large-v2', label: 'Large v2', desc: 'Very accurate · 6GB VRAM',   device: 'GPU' },
  { id: 'large-v3', label: 'Large v3', desc: 'Best accuracy · 6GB VRAM',   device: 'GPU' },
]

const LANGS = [
  { code:'en',name:'English'},{ code:'fr',name:'French'},{ code:'de',name:'German'},
  { code:'es',name:'Spanish'},{ code:'it',name:'Italian'},{ code:'pt',name:'Portuguese'},
  { code:'ru',name:'Russian'},{ code:'zh',name:'Chinese'},{ code:'ja',name:'Japanese'},
  { code:'ko',name:'Korean'},{ code:'ar',name:'Arabic'},{ code:'hi',name:'Hindi'},
  { code:'tr',name:'Turkish'},{ code:'nl',name:'Dutch'},{ code:'pl',name:'Polish'},
]

const PRESET_TAGS = ['meeting','podcast','interview','lecture','call','conference','personal','research','news','tutorial']

export default function NewSessionModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { addSession, setProcessingStatus, setUploadProgress } = useStore()

  const [step, setStep] = useState<1|2>(1)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [model, setModel] = useState('small')
  const [lang, setLang] = useState('en')
  const [tags, setTags] = useState<string[]>([])
  const [customTag, setCustomTag] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  const onDrop = useCallback((f: File[]) => { if (f[0]) setFile(f[0]) }, [])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, maxFiles: 1,
    accept: { 'audio/*': ['.mp3','.wav','.m4a','.ogg','.flac','.aac'], 'video/mp4': ['.mp4'] },
  })

  const toggleTag = (t: string) =>
    setTags((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t])

  const addCustom = () => {
    const t = customTag.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags((p) => [...p, t])
    setCustomTag('')
  }

  const submit = async () => {
    if (!name.trim()) return toast.error('Name is required')
    if (!file)        return toast.error('Upload an audio file')
    setBusy(true)
    try {
      const { data: session } = await sessionsApi.create({ name: name.trim(), description: desc.trim() || undefined, model_size: model, target_language: lang, tags })
      addSession(session)
      setProcessingStatus(session.id, 'uploading')
      await transcribeApi.upload(session.id, file, (p) => setUploadProgress(session.id, p))
      setProcessingStatus(session.id, 'transcribing')
      toast.success('Processing started!')
      onClose()
      navigate(`/session/${session.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
         onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div onClick={(e) => e.stopPropagation()}
           className="relative w-full sm:max-w-lg glass-heavy rounded-t-3xl sm:rounded-2xl
                      overflow-hidden animate-scale-in">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
          <div>
            <h2 className="font-body font-semibold text-white">New Session</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">Step {step} / 2</p>
          </div>
          <button onClick={onClose} className="btn-icon"><X size={16} /></button>
        </div>

        {/* Step bar */}
        <div className="flex gap-1.5 px-6 pt-4">
          {[1,2].map((s) => (
            <div key={s} className={`h-[3px] flex-1 rounded-full transition-all duration-500
              ${step >= s ? 'bg-neon' : 'bg-surface-600'}`} />
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[65vh] overflow-y-auto space-y-5">

          {step === 1 && (
            <div className="space-y-5 animate-fade-in">

              {/* Name */}
              <div>
                <label className="label block mb-2">Session name *</label>
                <input className="input" placeholder="e.g. Product Roadmap Meeting"
                       value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>

              {/* Description */}
              <div>
                <label className="label block mb-2">Description</label>
                <textarea className="textarea" rows={2} placeholder="Optional context..."
                          value={desc} onChange={(e) => setDesc(e.target.value)} />
              </div>

              {/* Model */}
              <div>
                <label className="label flex items-center gap-1.5 mb-2"><Cpu size={10} />Whisper Model</label>
                <div className="grid grid-cols-2 gap-2">
                  {MODELS.map((m) => (
                    <button key={m.id} onClick={() => setModel(m.id)}
                      className={`relative text-left p-3 rounded-xl border transition-all duration-200
                        ${model === m.id
                          ? 'border-neon/40 bg-neon/[0.07] text-white'
                          : 'border-white/[0.07] bg-surface-800 text-slate-400 hover:border-white/[0.12]'}`}>
                      {m.rec && <span className="absolute top-2 right-2 text-[8px] font-mono font-semibold text-neon bg-neon/10 px-1.5 py-0.5 rounded-full">REC</span>}
                      <div className="font-body font-semibold text-sm">{m.label}</div>
                      <div className="text-[11px] mt-0.5 opacity-60">{m.desc}</div>
                      <div className={`text-[10px] mt-1 font-mono font-semibold ${m.device === 'GPU' ? 'text-ember' : 'text-ice'}`}>{m.device}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div>
                <label className="label flex items-center gap-1.5 mb-2"><Globe size={10} />Output Language</label>
                <div className="relative">
                  <select className="input appearance-none pr-9 cursor-pointer"
                          value={lang} onChange={(e) => setLang(e.target.value)}>
                    {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="label flex items-center gap-1.5 mb-2"><Tag size={10} />Tags</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PRESET_TAGS.map((t) => (
                    <button key={t} onClick={() => toggleTag(t)}
                      className={`tag-btn text-[11px] ${tags.includes(t) ? 'tag-active' : ''}`}>
                      {tags.includes(t) && <Check size={9} />}{t}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input className="input py-2 text-xs" placeholder="Custom tag..."
                         value={customTag} onChange={(e) => setCustomTag(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && addCustom()} />
                  <button onClick={addCustom} className="btn-ghost py-2 px-3 text-xs flex-shrink-0">Add</button>
                </div>
                {tags.filter((t) => !PRESET_TAGS.includes(t)).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tags.filter((t) => !PRESET_TAGS.includes(t)).map((t) => (
                      <button key={t} onClick={() => toggleTag(t)} className="tag-active tag text-[11px] cursor-pointer">
                        {t}<X size={9} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 animate-fade-in">

              {/* Dropzone */}
              <div {...getRootProps()}
                className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer
                            transition-all duration-300 select-none
                            ${isDragActive ? 'border-neon bg-neon/[0.04]'
                              : file ? 'border-neon/40 bg-neon/[0.03]'
                              : 'border-white/10 hover:border-white/20 bg-surface-800/50'}`}>
                <input {...getInputProps()} />

                {file ? (
                  <div className="space-y-3">
                    {/* live waveform */}
                    <div className="flex items-end justify-center gap-1 h-9">
                      {[...Array(7)].map((_, i) => <div key={i} className="wave-bar" />)}
                    </div>
                    <p className="font-body font-semibold text-neon text-sm truncate px-4">{file.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    <p className="text-[11px] text-slate-700">Click or drop to replace</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center transition-all duration-300
                                    ${isDragActive ? 'bg-neon/20' : 'bg-surface-700'}`}>
                      <Upload size={20} className={isDragActive ? 'text-neon' : 'text-slate-500'} />
                    </div>
                    <div>
                      <p className="font-body font-semibold text-slate-200 text-sm">
                        {isDragActive ? 'Release to upload' : 'Drop your audio file here'}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">MP3 · WAV · M4A · OGG · FLAC · Max 500 MB</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Summary card */}
              <div className="glass rounded-xl p-4">
                <p className="label mb-3">Session Summary</p>
                <dl className="space-y-1.5">
                  {[
                    ['Name', name],
                    ['Model', MODELS.find((m) => m.id === model)?.label],
                    ['Output', LANGS.find((l) => l.code === lang)?.name],
                    tags.length ? ['Tags', tags.join(', ')] : null,
                  ].filter(Boolean).map(([k, v]) => (
                    <div key={k as string} className="flex gap-3 text-sm">
                      <dt className="text-slate-500 w-16 flex-shrink-0">{k}</dt>
                      <dd className="text-slate-200 truncate">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.07]">
          <button onClick={step === 1 ? onClose : () => setStep(1)} className="btn-ghost">
            {step === 1 ? 'Cancel' : '← Back'}
          </button>

          {step === 1 ? (
            <button onClick={() => { if (!name.trim()) { toast.error('Name required'); return } setStep(2) }}
                    className="btn-primary">
              Continue →
            </button>
          ) : (
            <button onClick={() => void submit()} disabled={busy || !file} className="btn-primary">
              {busy ? (
                <><span className="w-3.5 h-3.5 border-2 border-surface-950 border-t-transparent rounded-full animate-spin-slow" />Starting…</>
              ) : (
                <><Mic2 size={14} />Start Processing</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}