<div align="center">

<br/>

```
██╗   ██╗███████╗██████╗ ██████╗  █████╗ ████████╗██╗███╗   ███╗
██║   ██║██╔════╝██╔══██╗██╔══██╗██╔══██╗╚══██╔══╝██║████╗ ████║
██║   ██║█████╗  ██████╔╝██████╔╝███████║   ██║   ██║██╔████╔██║
╚██╗ ██╔╝██╔══╝  ██╔══██╗██╔══██╗██╔══██║   ██║   ██║██║╚██╔╝██║
 ╚████╔╝ ███████╗██║  ██║██████╔╝██║  ██║   ██║   ██║██║ ╚═╝ ██║
  ╚═══╝  ╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝╚═╝     ╚═╝
```

**Audio → Transcription → Translation → Structured Notes**

<br/>

![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Whisper](https://img.shields.io/badge/Whisper-faster--whisper-FF6B35?style=for-the-badge&logo=openai&logoColor=white)

<br/>

> *Drop an audio file. Get precise transcriptions, multilingual translations, and AI-structured notes — all running locally on your machine.*

<br/>

</div>

---

## ✦ What is Verbatim?

**Verbatim** is a self-hosted, multilingual audio notes agent. It takes any audio file — a meeting recording, podcast, interview, lecture — runs it through **OpenAI Whisper** locally, translates the output into any of **22+ languages**, and generates structured notes with summaries, key points, action items, and notable quotes.

Everything runs **on your machine**. No cloud APIs required. No data leaves your system.

---

## ✦ Features

| Feature | Details |
|---|---|
| 🎙️ **Audio Transcription** | Powered by `faster-whisper` — 6 model sizes from Tiny to Large-v3 |
| 🌍 **Multilingual Translation** | Helsinki-NLP local models — 22+ languages, fully offline |
| 📝 **Structured Notes** | Summary, key points, action items, quotes — rule-based or LLM |
| 🏷️ **Session Tagging** | Tag sessions as meeting, podcast, interview, lecture, and more |
| 📄 **PDF Export** | Styled PDF with cover page, notes, transcript, and segments |
| 🔄 **Multi-Session** | Manage multiple audio sessions from a single dashboard |
| ⚡ **Real-time Progress** | Live pipeline status — uploading → transcribing → translating → notes |
| 🖥️ **Local First** | SQLite database, local file storage, no cloud dependencies |

---

## ✦ Tech Stack

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│   React 18 · TypeScript · Vite · Tailwind CSS v3            │
│   Zustand · Framer Motion · React Dropzone · Axios          │
├─────────────────────────────────────────────────────────────┤
│                         BACKEND                             │
│   FastAPI · SQLAlchemy · SQLite · Pydantic                  │
│   faster-whisper · Helsinki-NLP (HuggingFace Transformers)  │
│   WeasyPrint · Uvicorn                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## ✦ Project Structure

```
multilingual-notes-agent/
│
├── backend/
│   ├── api/routes/          # sessions, transcribe, notes, export, meta
│   ├── db/                  # SQLAlchemy engine + SQLite database
│   ├── models/              # ORM models + Pydantic schemas
│   ├── services/            # whisper, translate, notes, pdf services
│   ├── uploads/             # audio file storage (gitignored)
│   ├── config.py            # environment settings
│   ├── main.py              # FastAPI app entry point
│   └── requirements.txt
│
├── frontend/
│   └── src/
│       ├── api/             # typed axios client
│       ├── components/      # UI components
│       ├── hooks/           # session polling + workspace hooks
│       ├── pages/           # Dashboard + Session workspace
│       ├── store/           # Zustand global state
│       ├── styles/          # Tailwind CSS + design system
│       └── types/           # shared TypeScript types
│
├── .gitignore
└── README.md
```

---

## ✦ Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- Git

> **Windows users:** WeasyPrint requires GTK. Install via [GTK for Windows](https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases) or use WSL.

---

### 1 · Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/multilingual-notes-agent.git
cd multilingual-notes-agent
```

---

### 2 · Backend setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Mac/Linux

# Install dependencies
pip install sentencepiece --prefer-binary
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env as needed

# Start the backend
python main.py
```

Backend runs at → **http://localhost:8000**
API docs at → **http://localhost:8000/docs**

---

### 3 · Frontend setup

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Frontend runs at → **http://localhost:5173**

---

## ✦ Configuration

All settings are in `backend/.env`. Key options:

```env
# Whisper model size: tiny | base | small | medium | large-v2 | large-v3
WHISPER_MODEL_SIZE=small

# Device: cpu | cuda
WHISPER_DEVICE=cpu

# Translation backend: helsinki | libretranslate
TRANSLATION_BACKEND=helsinki

# Notes generation: none | ollama | anthropic
NOTES_BACKEND=none

# Optional: Anthropic API key for Claude-powered notes
ANTHROPIC_API_KEY=

# Optional: Ollama for local LLM notes
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=mistral
```

---

## ✦ Whisper Models

| Model | Speed | Accuracy | Device | VRAM |
|---|---|---|---|---|
| `tiny` | ⚡⚡⚡⚡ | ★☆☆☆ | CPU | — |
| `base` | ⚡⚡⚡ | ★★☆☆ | CPU | — |
| `small` | ⚡⚡ | ★★★☆ | CPU | — |
| `medium` | ⚡ | ★★★★ | GPU | 4 GB |
| `large-v2` | 🐌 | ★★★★ | GPU | 6 GB |
| `large-v3` | 🐌 | ★★★★★ | GPU | 6 GB |

> `small` is recommended for CPU. Models download automatically on first use.

---

## ✦ Supported Languages

`English` `French` `German` `Spanish` `Italian` `Portuguese` `Dutch` `Russian`
`Chinese` `Japanese` `Korean` `Arabic` `Hindi` `Turkish` `Polish` `Swedish`
`Danish` `Finnish` `Norwegian` `Czech` `Romanian` `Hungarian` `Ukrainian`

---

## ✦ Notes Generation Backends

| Backend | Setup | Quality | Cost |
|---|---|---|---|
| `none` | Zero setup | Rule-based extraction | Free |
| `ollama` | Install [Ollama](https://ollama.ai) + pull a model | Good | Free |
| `anthropic` | Add `ANTHROPIC_API_KEY` to `.env` | Excellent | Paid |

---

## ✦ API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/sessions` | Create a new session |
| `GET` | `/api/sessions` | List all sessions |
| `GET` | `/api/sessions/:id` | Get session details |
| `PATCH` | `/api/sessions/:id` | Update session / tags |
| `DELETE` | `/api/sessions/:id` | Delete session |
| `POST` | `/api/transcribe/:id` | Upload audio + start pipeline |
| `GET` | `/api/transcribe/:id` | Get transcript |
| `GET` | `/api/notes/:id` | Get structured notes |
| `PATCH` | `/api/notes/:id` | Edit notes |
| `POST` | `/api/notes/:id/regenerate` | Regenerate notes |
| `POST` | `/api/export/:id/pdf` | Export as styled PDF |
| `GET` | `/api/meta` | Languages + model metadata |

Full interactive docs → **http://localhost:8000/docs**

---

## ✦ Processing Pipeline

```
Audio Upload
     │
     ▼
┌─────────────┐
│   Whisper   │  faster-whisper — transcribes audio into text segments
│ Transcribe  │  detects source language automatically
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Helsinki   │  opus-mt models — translates to target language
│  Translate  │  per-segment + full text translation
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    Notes    │  rule-based / Ollama / Claude
│  Generator  │  summary · bullets · topics · actions · quotes
└──────┬──────┘
       │
       ▼
  SQLite DB + Ready for Export
```

---

## ✦ Known Limitations

- **CPU speed** — `small` model processes ~1 min audio per 30–60 seconds on CPU
- **Helsinki models** — ~300MB per language pair, downloaded on first use
- **WeasyPrint on Windows** — requires GTK runtime for PDF export
- **No auth** — single-user, local use only. Do not expose to public internet

---

<div align="center">

<br/>

Built with 🎙️ by **Verbatim**

*Local. Private. Precise.*

<br/>

</div>
