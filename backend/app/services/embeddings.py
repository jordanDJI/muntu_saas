"""
Service d'embedding Gemini text-embedding-004 (768 dim) pour le RAG Agent 2.
"""
import logging

logger = logging.getLogger(__name__)


def generate_embedding(text: str) -> list[float]:
    """Génère un embedding 768-dim pour l'indexation d'un document."""
    import google.generativeai as genai
    from app.core.config import settings
    genai.configure(api_key=settings.GEMINI_API_KEY)
    result = genai.embed_content(
        model="models/text-embedding-004",
        content=text[:8000],
        task_type="retrieval_document",
    )
    return result["embedding"]


def generate_query_embedding(text: str) -> list[float]:
    """Génère un embedding 768-dim pour une requête de recherche."""
    import google.generativeai as genai
    from app.core.config import settings
    genai.configure(api_key=settings.GEMINI_API_KEY)
    result = genai.embed_content(
        model="models/text-embedding-004",
        content=text[:2000],
        task_type="retrieval_query",
    )
    return result["embedding"]


def chunk_text(text: str, chunk_size: int = 600, overlap: int = 100) -> list[str]:
    """Découpe un texte en chunks avec chevauchement."""
    text = text.strip()
    if not text:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += chunk_size - overlap
    return chunks
