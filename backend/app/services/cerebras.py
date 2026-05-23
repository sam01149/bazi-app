import os
import json
import urllib.request
from typing import Dict, Any

CEREBRAS_API_KEY = os.getenv("CEREBRAS_API_KEY", "")
CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions" # Adjust if standard OpenAI wrapper URL

def generate_narasi(chart_data: Dict[str, Any], section: str) -> str:
    """
    Generates narration using Cerebras API based on structured chart data.
    """
    if not CEREBRAS_API_KEY:
        return "Cerebras API key is not configured. Ini adalah teks placeholder narasi untuk V1."
        
    system_prompt = """Kamu adalah interpreter BaZi menggunakan framework Zi Ping Zhen Quan (子平真詮).
Tugas kamu: tulis narasi bahasa Indonesia yang mudah dipahami berdasarkan DATA TERSTRUKTUR yang diberikan.

ATURAN KETAT:
1. Jangan membuat interpretasi di luar data yang diberikan
2. Selalu gunakan framing probabilistik: "kecenderungan", "pola", bukan "pasti" atau "akan"
3. Semua interpretasi harus dikaitkan dengan domain kehidupan konkret
4. Bahasa: Indonesia, conversational, tidak terlalu formal
5. Panjang: maksimal 3 paragraf per section
6. Selalu sertakan: "Menurut framework Zi Ping Zhen Quan"
"""

    user_content = json.dumps({
        "chart_data": chart_data,
        "section": section
    }, ensure_ascii=False)
    
    headers = {
        "Authorization": f"Bearer {CEREBRAS_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "llama3.1-70b",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ],
        "temperature": 0.7,
        "max_tokens": 1000
    }
    
    req = urllib.request.Request(CEREBRAS_API_URL, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode('utf-8'))
            return result['choices'][0]['message']['content'].strip()
    except Exception as e:
        print(f"Error calling Cerebras API: {e}")
        return "Gagal menghasilkan narasi karena masalah koneksi AI. Ini adalah teks placeholder narasi untuk V1."
