import os
import json
import logging
import httpx
from typing import Dict, Any, List

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


async def _call_cerebras(messages: list, max_tokens: int = 1000) -> str:
    if not CEREBRAS_API_KEY:
        logger.error("CEREBRAS_API_KEY tidak dikonfigurasi")
        return "API key AI tidak dikonfigurasi. Tambahkan CEREBRAS_API_KEY ke environment."

    payload = {
        "model": "llama-3.3-70b",
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
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()
    except httpx.HTTPStatusError as e:
        logger.error("Cerebras HTTP %s: %s", e.response.status_code, e.response.text)
        return f"Gagal menghasilkan narasi (HTTP {e.response.status_code}). Periksa API key dan coba lagi."
    except Exception as e:
        logger.error("Cerebras error: %s", e)
        return f"Gagal menghasilkan narasi: {e}"


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


async def generate_calendar_narasi(
    chart_data: Dict[str, Any],
    calendar_data: Dict[str, Any],
    interactions: List[Dict[str, Any]],
) -> str:
    system = """Kamu adalah interpreter BaZi menggunakan framework Zi Ping Zhen Quan (子平真詮).
Berdasarkan chart natal pengguna dan energi kalender BaZi hari ini, tulis ringkasan singkat:
1. Bagaimana energi hari ini berinteraksi dengan chart natal?
2. Apa yang perlu diperhatikan atau dimanfaatkan hari ini?

ATURAN:
- Bahasa Indonesia, ringkas (maksimal 2 paragraf)
- Conversational, tidak terlalu formal
- Framing probabilistik
"""
    user_content = json.dumps({
        "chart_natal": chart_data,
        "kalender_hari_ini": calendar_data["pillars"],
        "interaksi": interactions,
    }, ensure_ascii=False)

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_content},
    ]
    return await _call_cerebras(messages, max_tokens=600)
