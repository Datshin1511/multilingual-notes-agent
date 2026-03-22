from fastapi import APIRouter
from models.schemas import MetadataResponse, SupportedLanguage, SupportedModel
from config import settings

router = APIRouter(prefix="/meta", tags=["Metadata"])

SUPPORTED_LANGUAGES = [
    ("en", "English", "English"),
    ("fr", "French", "Français"),
    ("de", "German", "Deutsch"),
    ("es", "Spanish", "Español"),
    ("it", "Italian", "Italiano"),
    ("pt", "Portuguese", "Português"),
    ("nl", "Dutch", "Nederlands"),
    ("ru", "Russian", "Русский"),
    ("zh", "Chinese (Simplified)", "中文"),
    ("ja", "Japanese", "日本語"),
    ("ko", "Korean", "한국어"),
    ("ar", "Arabic", "العربية"),
    ("hi", "Hindi", "हिन्दी"),
    ("tr", "Turkish", "Türkçe"),
    ("pl", "Polish", "Polski"),
    ("sv", "Swedish", "Svenska"),
    ("da", "Danish", "Dansk"),
    ("fi", "Finnish", "Suomi"),
    ("cs", "Czech", "Čeština"),
    ("ro", "Romanian", "Română"),
    ("hu", "Hungarian", "Magyar"),
    ("uk", "Ukrainian", "Українська"),
]

WHISPER_MODELS = [
    ("tiny",     "Whisper Tiny",     "Fastest, least accurate. Good for quick testing.",                    "cpu",  0.0),
    ("base",     "Whisper Base",     "Fast, decent accuracy. Good for clean audio.",                        "cpu",  0.0),
    ("small",    "Whisper Small",    "Best CPU balance. Recommended for most use cases.",                   "cpu",  0.0),
    ("medium",   "Whisper Medium",   "High accuracy. Needs ~4GB RAM. Slow on CPU.",                         "gpu",  4.0),
    ("large-v2", "Whisper Large v2", "Very high accuracy. Needs GPU (6GB+ VRAM).",                          "gpu",  6.0),
    ("large-v3", "Whisper Large v3", "State-of-the-art accuracy. Best results, heaviest resource use.",     "gpu",  6.0),
]

PREDEFINED_TAGS = [
    "meeting", "podcast", "interview", "lecture", "call", "conference",
    "personal", "notes", "research", "news", "sermon", "tutorial",
]


@router.get("", response_model=MetadataResponse)
def get_metadata():
    return MetadataResponse(
        languages=[
            SupportedLanguage(code=c, name=n, native_name=nn)
            for c, n, nn in SUPPORTED_LANGUAGES
        ],
        whisper_models=[
            SupportedModel(
                id=mid,
                name=mname,
                description=desc,
                recommended_device=device,
                vram_required_gb=vram if vram > 0 else None,
            )
            for mid, mname, desc, device, vram in WHISPER_MODELS
        ],
        translation_backend=settings.TRANSLATION_BACKEND,
        notes_backend=settings.NOTES_BACKEND,
    )


@router.get("/tags")
def get_predefined_tags():
    return {"tags": PREDEFINED_TAGS}