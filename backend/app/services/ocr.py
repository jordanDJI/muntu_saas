import logging
from google import genai
from google.genai import types
from app.core.config import settings

logger = logging.getLogger(__name__)

_ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "application/pdf"}

_OCR_SYSTEM = (
    "Tu es un assistant médical administratif. "
    "Extrais les informations clés du document (type de document, médicaments, "
    "dosages, dates, prescripteur, pathologie mentionnée). "
    "Produis un résumé structuré en français. "
    "N'invente aucune information absente du document."
)


def extract_summary(file_bytes: bytes, mime_type: str, model: str = "gemini-2.0-flash") -> str:
    """
    Traite un document médical via Gemini Vision et renvoie un résumé textuel.
    Le fichier source n'est jamais persisté — uniquement le résumé retourné ici.
    """
    if mime_type not in _ALLOWED_MIME:
        raise ValueError(f"Type de fichier non supporté : {mime_type}")

    max_bytes = settings.agent_ocr_max_size_mb * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise ValueError(f"Fichier trop volumineux (max {settings.agent_ocr_max_size_mb} Mo)")

    client = genai.Client(api_key=settings.gemini_api_key)
    try:
        resp = client.models.generate_content(
            model=model,
            contents=[
                types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                types.Part(text="Extrais et résume les informations clés de ce document."),
            ],
            config=types.GenerateContentConfig(system_instruction=_OCR_SYSTEM),
        )
        return resp.text.strip()
    except Exception as exc:
        logger.error("OCR Gemini Vision error: %s", exc)
        raise
    finally:
        del file_bytes
