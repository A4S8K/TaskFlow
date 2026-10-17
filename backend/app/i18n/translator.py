import json
from pathlib import Path

from fastapi import Request

LOCALES = {
    lang: json.loads((Path(__file__).parent / "locales" / f"{lang}.json").read_text(encoding="utf-8"))
    for lang in ("en", "ru", "kk")
}


def language(request: Request) -> str:
    explicit = request.query_params.get("lang")
    if explicit is not None:
        return explicit if explicit in LOCALES else "en"
    candidates = []
    for position, part in enumerate(request.headers.get("accept-language", "").split(",")):
        bits = part.strip().split(";")
        lang = bits[0].lower().split("-")[0]
        quality = 1.0
        try:
            for bit in bits[1:]:
                if bit.strip().startswith("q="):
                    quality = float(bit.strip()[2:])
        except ValueError:
            continue
        if lang in LOCALES and 0 < quality <= 1:
            candidates.append((quality, -position, lang))
    if candidates:
        return max(candidates)[2]
    return getattr(request.state, "preferred_language", "en")


def response(request: Request, code: str, data=None) -> dict:
    lang = language(request)
    return {"code": code, "message": LOCALES[lang].get(code, LOCALES[lang]["INTERNAL_ERROR"]), "data": data}
