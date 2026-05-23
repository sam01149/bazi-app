import os
import json
import logging
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

async def generate_narasi(chart_data: Dict[str, Any], section: str) -> str:
    if not CEREBRAS_API_KEY:
        logger.error("CEREBRAS_API_KEY tidak dikonfigurasi di environment")
        return "API key AI tidak dikonfigurasi. Tambahkan CEREBRAS_API_KEY ke HuggingFace Space secrets."

    payload = {
        "model": "llama-3.3-70b",
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user",   "content": json.dumps({"chart_data": chart_data, "section": section}, ensure_ascii=False)},
        ],
        "temperature": 0.7,
        "max_tokens": 1000,
    }

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
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
