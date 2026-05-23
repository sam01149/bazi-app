# BaZi App — Project Context

## Apa ini

Aplikasi mobile interpreter BaZi (四柱/八字) untuk pengguna non-praktisi. User input tanggal/waktu/timezone lahir, app menghitung chart BaZi dan menghasilkan narasi Bahasa Indonesia menggunakan framework Zi Ping Zhen Quan (子平真詮).

---

## Stack

| Layer | Tech |
|-------|------|
| Mobile | React Native 0.85.3, Expo 56.0.3, TypeScript, React Navigation 7 |
| Backend | Python FastAPI, SQLAlchemy async, Supabase PostgreSQL (prod) / SQLite (dev), uvicorn |
| Astronomi | pyswisseph (solar terms akurat) |
| AI | Cerebras API — model `llama-3.3-70b` |
| Build | Expo EAS (APK), Docker (backend) |

---

## Struktur File

```
Self app/
├── BAZI_APP_TECHNICAL_BRIEF.md     — spesifikasi lengkap (referensi utama)
├── bazi_app.md                     — file ini
├── backend/
│   ├── main.py                     — FastAPI app + CORS + lifespan DB init
│   ├── requirements.txt
│   ├── .env                        — CEREBRAS_API_KEY (jangan commit!)
│   ├── .gitignore                  — exclude .env, *.db, venv/
│   ├── Dockerfile
│   └── app/
│       ├── database.py             — SQLAlchemy async engine (SQLite dev / PG prod)
│       ├── models/
│       │   ├── domain.py           — ORM: User, BaZiChart, TenGod
│       │   └── schemas.py          — Pydantic request/response schemas
│       ├── api/
│       │   └── router.py           — semua endpoint API
│       ├── engine/
│       │   ├── calculator.py       — kalkulasi pilar, Ten Gods, day master strength
│       │   ├── tables.py           — tabel konstan BaZi (stems, branches, interactions)
│       │   └── interactions.py     — deteksi clash/combination/harm/penalty
│       └── services/
│           └── cerebras.py         — generate narasi via Cerebras API
└── bazi-app/
    ├── App.tsx                     — navigation root (SafeAreaProvider + Stack Navigator)
    ├── App.nav.tsx                 — duplikat lama, tidak dipakai
    ├── index.ts                    — entry point Expo (import dari App.tsx)
    ├── .env                        — EXPO_PUBLIC_API_URL=http://<IP>:8000/api
    ├── app.json                    — Expo config
    ├── eas.json                    — EAS Build config
    └── src/
        ├── config.ts               — API_URL (baca EXPO_PUBLIC_API_URL)
        └── screens/
            ├── OnboardingScreen.tsx
            ├── ChartScreen.tsx
            └── CalendarScreen.tsx
```

---

## API Endpoints

| Method | Path | Fungsi |
|--------|------|--------|
| `POST` | `/api/charts/calculate` | Hitung chart BaZi dari tanggal/waktu/timezone |
| `GET`  | `/api/charts/{chart_id}` | Ambil chart yang sudah tersimpan |
| `GET`  | `/api/calendar/current?timezone=&chart_id=` | Pilar hari ini + interaksi dengan chart user |
| `POST` | `/api/narasi/generate` | Generate narasi AI untuk section tertentu |
| `GET`  | `/api/solar-terms/year/{year}` | 24 solar terms dalam satu tahun (UTC) |

### Contoh request calculate:
```json
POST /api/charts/calculate
{
  "birth_date": "1990-05-15",
  "birth_time": "14:30:00",   // null jika jam tidak diketahui
  "birth_timezone": "Asia/Jakarta"
}
```

### Contoh request narasi:
```json
POST /api/narasi/generate
{
  "chart_id": "uuid-dari-chart",
  "section": "daymaster"  // atau: career, wealth, relationship
}
```

---

## Logika Engine (calculator.py)

### Year Pillar
- Tahun BaZi berganti di **Li Chun** (立春, solar term index 2), bukan 1 Januari
- Dihitung via pyswisseph (binary search posisi Matahari 285°)
- Anchor: tahun 1984 = 甲子 (Jiazi index 0)

### Month Pillar
- Berganti tiap 2 solar terms (major terms)
- Stem dihitung via Five Tigers Method (五虎遁年起月法)

### Day Pillar
- Anchor: 2000-01-01 = 甲子 (index 0)
- Pakai local date (bukan UTC) — hari BaZi ikut tengah malam lokal

### Hour Pillar
- 12 double-hours (子時 = 23:00–01:00, dst.)
- Stem dihitung via Five Rats Method
- Pakai local hour

### Ten Gods (十神)
- Dihitung hanya untuk Year Stem, Month Stem, Hour Stem terhadap Day Master
- Day Stem = Day Master sendiri (ditampilkan sebagai `日主`)

### Day Master Strength
- **Month branch** = indikator utama, bobot ×3
- Semua branch lain (year, day, hour) = bobot ×1
- Semua stem lain (year, month, hour) = bobot ×1
- Skala: `Strong / Moderate-Strong / Moderate / Moderate-Weak / Weak`

### Interaction Detection (interactions.py)
Mendeteksi antara branch chart natal user vs branch kalender saat ini:
- **Clash** (六冲) — SIX_CLASHES
- **Six Combination** (六合) — SIX_COMBINATIONS
- **Harm** (六害) — SIX_HARMS  
- **Penalty** (刑) — THREE_PENALTIES (expanded jadi pair-based)
- **Self-Penalty** — branch 辰/午/酉/亥 yang sama di kedua chart

---

## Screen Flow

```
OnboardingScreen
  → input: date (YYYY-MM-DD), time (HH:MM), timezone
  → toggle: "Jam Tidak Diketahui" (kirim null → backend default 12:00)
  → validasi: format, range jam/menit, timezone tidak kosong
      ↓
ChartScreen
  → POST /api/charts/calculate
  → tampil 4 pilar: 年(Tahun) → 月(Bulan) → 日(Hari) → 時(Jam)
  → tampil Ten Gods per stem, Day Master strength
  → tombol seksi narasi: Day Master / Karir / Kekayaan / Hubungan
      → POST /api/narasi/generate → tampil narasi AI
  → tombol "Cek Kalender BaZi" → pass chartId + timezone
      ↓
CalendarScreen
  → GET /api/calendar/current?timezone=...&chart_id=...
  → tampil pilar hari ini (urutan sama: Year→Month→Day→Hour)
  → tampil interaksi (clash/combination/harm/penalty)
  → jika tidak ada interaksi: pesan "Tidak ada interaksi signifikan..."
  → jika tidak ada chartId: hanya tampil pilar kalender tanpa interaksi
```

---

## Deployment (Production)

| Komponen | Platform | URL |
|----------|----------|-----|
| Backend | HuggingFace Spaces (Docker, free) | `https://samsam010-bazi-backend.hf.space` |
| Frontend Web | Vercel (free) | `https://bazi-app-two.vercel.app` |
| Database | Supabase PostgreSQL (free) | Transaction Pooler port 6543 |

**HF Spaces push:** dari `hf-deploy/` folder, `git push hf master:main`

**Catatan penting:**
- `statement_cache_size=0` di engine — wajib untuk pgbouncer Transaction Pooler
- `birth_datetime` disimpan tanpa tzinfo (TIMESTAMP WITHOUT TIME ZONE), timezone disimpan terpisah
- Semua env vars (`CEREBRAS_API_KEY`, `DATABASE_URL`) harus di-set sebagai **Secrets** (bukan Variables) di HF Spaces Settings

---

## Status Saat Ini (2026-05-23)

### Sudah Selesai ✅
- Kalkulasi semua pilar (Year, Month, Day, Hour)
- Ten Gods untuk 3 stem (year, month, hour vs day master)
- Day Master Strength calculation (bukan hardcoded)
- Interaksi: Clash + Six Combination + Six Harms + Three Penalties
- Frontend: navy + gold theme (konsisten dengan logo)
- Frontend: date/time picker native HTML untuk web, timezone preset WIB/WITA/WIT
- Frontend: logo SVG ditampilkan di header OnboardingScreen
- Deployment: backend di HF Spaces, frontend di Vercel, DB di Supabase
- AI narasi async dengan httpx, full pillar context dikirim ke Cerebras
- Fix: `FLG_MOSEPH` untuk ephemeris tanpa file eksternal
- Fix: `statement_cache_size=0` untuk pgbouncer compatibility
- Fix: `tzinfo=None` sebelum insert ke TIMESTAMP WITHOUT TIME ZONE
- Fix: semua `chart_id` pakai `str` bukan `UUID` (VARCHAR column mismatch)
- Fix: CORS `allow_credentials=False` (wildcard origin + credentials tidak valid)

### Belum Ada / Known Issues ⚠️
- **Tidak ada unit tests** — engine calculation belum ditest
- **Alembic migrations belum setup** — pakai `create_all()` (ok untuk sekarang)
- **Hidden Stems Ten Gods** — belum diimplementasi
- **Tidak ada saved charts list** — user tidak bisa lihat history chart

---

## Cara Menjalankan

### Backend
```powershell
cd "c:\Users\sam\Documents\kerja\Self app\backend"
.\venv\Scripts\activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
Swagger docs: `http://localhost:8000/docs`

### Frontend
```powershell
cd "c:\Users\sam\Documents\kerja\Self app\bazi-app"
# Pastikan .env sudah diisi IP laptop yang benar:
# EXPO_PUBLIC_API_URL=http://192.168.X.X:8000/api
npx expo start
```

---

## Referensi Penting
- `BAZI_APP_TECHNICAL_BRIEF.md` — spesifikasi lengkap (kalkulasi, screen, data model)
- `backend/app/engine/tables.py` — semua tabel BaZi (stems, branches, hidden stems, interactions)
- Cerebras API key: lihat `backend/.env` (jangan share)
