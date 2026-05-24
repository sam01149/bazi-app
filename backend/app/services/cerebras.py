import os
import json
import logging
import asyncio
import httpx
from typing import Dict, Any

logger = logging.getLogger(__name__)

CEREBRAS_API_KEY = os.getenv("CEREBRAS_API_KEY", "")
CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions"

_SYSTEM_PROMPT = """Kamu adalah interpreter BaZi menggunakan framework Zi Ping Zhen Quan (子平真詮).
Tugas kamu: tulis narasi bahasa Indonesia yang mudah dipahami berdasarkan DATA TERSTRUKTUR yang diberikan.

ATURAN KETAT:
1. Jangan membuat interpretasi di luar data yang diberikan
2. Selalu gunakan framing probabilistik: "kecenderungan", "pola", bukan "pasti" atau "akan"
3. Semua interpretasi harus dikaitkan dengan domain kehidupan konkret
4. Bahasa: Indonesia, conversational, tidak terlalu formal
5. Panjang: maksimal 3 paragraf per section
6. Selalu sertakan: "Menurut framework Zi Ping Zhen Quan"
"""


_ERROR_PREFIX = "ERROR:"

# Phrases that only appear in error messages, never in real narasi content
_ERROR_PHRASES = [
    "Gagal menghasilkan narasi",
    "rate limited",
    "API key tidak",
    "Periksa API key",
    "Semua model sedang",
]

# Model cascade: jika model utama 429, otomatis coba model berikutnya
_MODEL_CASCADE = [
    "qwen-3-235b-a22b-instruct-2507",
    "gpt-oss-120b",
    "zai-glm-4.7",
    "llama3.1-8b",
]


def is_error_narasi(text: str) -> bool:
    """True jika teks adalah pesan error, bukan narasi nyata."""
    if not text or len(text) < 80:
        return True
    if text.startswith(_ERROR_PREFIX):
        return True
    # Deteksi format error lama yang tersimpan di cache tanpa prefix "ERROR:"
    return any(phrase in text for phrase in _ERROR_PHRASES)


async def _try_model(model: str, messages: list, max_tokens: int) -> tuple[str | None, bool]:
    """
    Returns (result, is_rate_limited).
    result=None means rate limited (try next model).
    """
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": max_tokens,
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                CEREBRAS_API_URL,
                headers={"Authorization": f"Bearer {CEREBRAS_API_KEY}", "Content-Type": "application/json"},
                json=payload,
            )
        if resp.status_code == 429:
            logger.warning("Cerebras 429 pada model %s — mencoba model berikutnya", model)
            return None, True
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip(), False
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 429:
            return None, True
        logger.error("Cerebras HTTP %s (model %s): %s", e.response.status_code, model, e.response.text)
        return f"{_ERROR_PREFIX} HTTP {e.response.status_code}.", False
    except Exception as e:
        logger.error("Cerebras error (model %s): %s", model, e)
        return f"{_ERROR_PREFIX} {e}", False


async def _call_cerebras(messages: list, max_tokens: int = 1000) -> str:
    if not CEREBRAS_API_KEY:
        logger.error("CEREBRAS_API_KEY tidak dikonfigurasi")
        return f"{_ERROR_PREFIX} API key AI tidak dikonfigurasi."

    for model in _MODEL_CASCADE:
        result, rate_limited = await _try_model(model, messages, max_tokens)
        if not rate_limited:
            if result and not is_error_narasi(result):
                logger.info("Narasi berhasil dengan model %s", model)
            return result or f"{_ERROR_PREFIX} Tidak ada respons dari model."

    return f"{_ERROR_PREFIX} Semua model sedang rate limited. Coba lagi dalam beberapa menit."


async def generate_narasi(chart_data: Dict[str, Any], section: str) -> str:
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": json.dumps({"chart_data": chart_data, "section": section}, ensure_ascii=False)},
    ]
    return await _call_cerebras(messages, max_tokens=1000)


async def generate_wish_analysis(chart_data: Dict[str, Any], wish_content: str) -> str:
    system = """Kamu adalah konsultan BaZi menggunakan framework Zi Ping Zhen Quan (子平真詮).
Berdasarkan chart BaZi pengguna dan keinginan yang mereka tuliskan, berikan analisis:
1. Apakah keinginan ini selaras dengan energi dominan dalam chart (elemen, Ten Gods)?
2. Hambatan apa yang mungkin muncul berdasarkan chart?
3. Strategi konkret (2-3 langkah) untuk mewujudkan keinginan tersebut sesuai pola energi chart.

ATURAN:
- Bahasa Indonesia, conversational
- Framing probabilistik: "kecenderungan", "cocok dengan pola", bukan "pasti"
- Maksimal 4 paragraf
- Selalu kaitkan dengan data chart yang diberikan
"""
    user_content = json.dumps({
        "chart_data": chart_data,
        "keinginan": wish_content,
    }, ensure_ascii=False)

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_content},
    ]
    return await _call_cerebras(messages, max_tokens=1200)


