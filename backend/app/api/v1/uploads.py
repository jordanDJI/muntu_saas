import io
import uuid
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from PIL import Image
from app.middleware.tenant import get_current_tenant
from app.core.supabase import get_supabase_admin

router = APIRouter(prefix="/uploads", tags=["uploads"])

BUCKET = "site-assets"
MAX_BYTES = 20 * 1024 * 1024  # 10 Mo
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

# (largeur, hauteur) cibles par section — mode cover (crop centré)
SECTION_DIMS: dict[str, tuple[int, int]] = {
    "hero":     (1920, 800),
    "about":    (800,  900),
    "services": (1920, 700),
    "contact":  (600,  700),
    "logo":     (400,  200),   # mode contain (pas de crop)
    "offer":    (800,  600),
    "avatar":   (300,  300),
}


def _cover(img: Image.Image, w: int, h: int) -> Image.Image:
    sw, sh = img.size
    ratio = max(w / sw, h / sh)
    nw, nh = round(sw * ratio), round(sh * ratio)
    img = img.resize((nw, nh), Image.LANCZOS)
    left, top = (nw - w) // 2, (nh - h) // 2
    return img.crop((left, top, left + w, top + h))


def _contain(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
    w, h = img.size
    ratio = min(max_w / w, max_h / h)
    if ratio >= 1:
        return img
    return img.resize((round(w * ratio), round(h * ratio)), Image.LANCZOS)


@router.post("/photo")
async def upload_photo(
    file: UploadFile = File(...),
    section: str = Query(...),
    tenant_id: str = Depends(get_current_tenant),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Format non supporté. Utilisez JPEG, PNG ou WebP.")

    dims = SECTION_DIMS.get(section)
    if not dims:
        raise HTTPException(400, f"Section inconnue : {section}")

    contents = await file.read()
    if len(contents) > MAX_BYTES:
        raise HTTPException(400, "Fichier trop volumineux (max 10 Mo).")

    try:
        img = Image.open(io.BytesIO(contents))
        # Préserver la transparence pour le logo, sinon RGB
        if section == "logo":
            if img.mode not in ("RGBA", "LA", "PA"):
                img = img.convert("RGBA")
            img = _contain(img, *dims)
        else:
            img = img.convert("RGB")
            img = _cover(img, *dims)
    except Exception:
        raise HTTPException(400, "Fichier image invalide ou corrompu.")

    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=85)
    buf.seek(0)
    webp_bytes = buf.read()

    path = f"{tenant_id}/{section}/{uuid.uuid4()}.webp"
    sb = get_supabase_admin()
    try:
        sb.storage.from_(BUCKET).upload(
            path=path,
            file=webp_bytes,
            file_options={"content-type": "image/webp", "upsert": "true"},
        )
    except Exception as e:
        raise HTTPException(500, f"Erreur de stockage Supabase : {e}")

    url: str = sb.storage.from_(BUCKET).get_public_url(path)
    return {"url": url}
