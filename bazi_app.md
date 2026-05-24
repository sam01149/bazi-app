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
| AI | SambaNova (primary: Meta-Llama-3.1-405B) + Cerebras (fallback) |
| Build | Expo EAS (APK), Docker (backend) |

---

## Struktur File

```
Self app/
├── BAZI_APP_TECHNICAL_BRIEF.md     — spesifikasi lengkap (referensi utama)
├── bazi_app.md                     — file ini
├── hf-deploy/                      — mirror backend untuk push ke HF Spaces
│   └── backend/                    — identik dengan backend/, git remote = hf
├── backend/
│   ├── main.py                     — FastAPI app + CORS + lifespan DB init
│   ├── requirements.txt
│   ├── .env                        — CEREBRAS_API_KEY (jangan commit!)
│   ├── .gitignore                  — exclude .env, *.db, venv/
│   ├── Dockerfile
│   └── app/
│       ├── database.py             — SQLAlchemy async engine (SQLite dev / PG prod)
│       ├── models/
│       │   ├── domain.py           — ORM: User, BaZiChart, TenGod, Wish, CachedNarasi
│       │   └── schemas.py          — Pydantic request/response schemas
│       ├── api/
│       │   └── router.py           — semua endpoint API
│       ├── engine/
│       │   ├── calculator.py       — kalkulasi pilar, Ten Gods, day master strength
│       │   ├── tables.py           — tabel konstan BaZi (stems, branches, interactions)
│       │   └── interactions.py     — deteksi clash/combination/harm/penalty
│       └── services/
│           └── cerebras.py         — generate narasi, wish analysis, calendar narasi
└── bazi-app/
    ├── App.tsx                     — navigation root (BottomTabNavigator: Kalender/Keinginan/Profil)
    ├── index.ts                    — entry point Expo
    ├── .env                        — EXPO_PUBLIC_API_URL=http://<IP>:8000/api
    ├── app.json                    — Expo config
    ├── eas.json                    — EAS Build config
    └── src/
        ├── config.ts               — API_URL (baca EXPO_PUBLIC_API_URL)
        ├── context/
        │   └── ChartContext.tsx    — shared chartId + timezone via AsyncStorage
        └── screens/
            ├── ProfileScreen.tsx   — onboarding + chart view + narasi sections
            ├── WishScreen.tsx      — tulis keinginan + analisis BaZi via AI
            └── CalendarScreen.tsx  — kalender bulanan + pilar BaZi + interaksi
```

---

## API Endpoints

| Method | Path | Fungsi |
|--------|------|--------|
| `POST` | `/api/charts/calculate` | Hitung chart BaZi dari tanggal/waktu/timezone |
| `GET`  | `/api/charts/{chart_id}` | Ambil chart yang sudah tersimpan |
| `GET`  | `/api/calendar/current?timezone=&chart_id=` | Pilar hari ini + interaksi + AI narasi |
| `GET`  | `/api/calendar/date/{YYYY-MM-DD}?timezone=&chart_id=` | Pilar tanggal tertentu + interaksi |
| `GET`  | `/api/profile/{chart_id}` | Chart + semua cached narasi sections |
| `POST` | `/api/narasi/generate` | Generate narasi AI (cached ke DB setelah pertama) |
| `POST` | `/api/calendar/narasi` | Narasi AI interaksi chart vs tanggal kalender (tidak di-cache) |
| `POST` | `/api/wishes` | Simpan keinginan baru |
| `GET`  | `/api/wishes?chart_id=` | List semua keinginan user |
| `DELETE` | `/api/wishes/{wish_id}` | Hapus keinginan |
| `POST` | `/api/wishes/{wish_id}/analyze` | Analisis keinginan vs chart BaZi via AI |
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
  "section": "full_analysis"
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
- Anchor: 2000-01-01 = 戊午 (index 54) — bukan 甲子! Derived: Jan 1 1900 = 甲戌 (10), +36524 days → (10+44)%60=54
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

## Screen Flow (Tab Navigation)

```
App (BottomTabNavigator)
  ├── Tab: Kalender (CalendarScreen)
  │   → Kalender grid bulanan, navigasi prev/next bulan
  │   → Klik tanggal → tampil pilar BaZi: Year/Month/Day
  │   → Hari ini: GET /api/calendar/current → pilar + AI narasi "Energi Hari Ini"
  │   → Tanggal lain: GET /api/calendar/date/{date}
  │   → Jika ada chartId: tampil interaksi (clash/combination/harm/penalty)
  │   → Jika tidak ada chartId: banner arahkan ke tab Profil
  │
  ├── Tab: Keinginan (WishScreen)
  │   → Jika tidak ada chartId: placeholder → arahkan ke tab Profil
  │   → Input teks keinginan → POST /api/wishes
  │   → List keinginan dengan expand/collapse
  │   → Klik "Analisis dengan BaZi Chart" → POST /api/wishes/{id}/analyze
  │   → Tampilkan analisis AI berdasarkan chart + keinginan
  │
  └── Tab: Profil (ProfileScreen)
      → Jika belum ada chart: form onboarding (tanggal/waktu/timezone)
          → POST /api/charts/calculate → simpan ke AsyncStorage
      → Jika sudah ada chart: GET /api/profile/{chart_id}
          → Tampil 4 pilar, Ten Gods, Day Master Strength
          → Tombol "Analisis Lengkap" → POST /api/narasi/generate (cached di DB, key: full_analysis)
          → Data kelahiran, tombol Reset Profil
```

---

## Deployment (Production)

| Komponen | Platform | URL |
|----------|----------|-----|
| Backend | HuggingFace Spaces (Docker, free) | `https://samsam010-bazi-backend.hf.space` |
| Frontend Web | Vercel (free) | `https://bazi-app-two.vercel.app` |
| Database | Supabase PostgreSQL (free) | Transaction Pooler port 6543 |

**HF Spaces push:** dari `hf-deploy/` folder:
```powershell
# 1. Sync file backend yang berubah ke hf-deploy/backend/
cp backend/app/... hf-deploy/backend/app/...
# 2. Commit dan push
cd hf-deploy
git add -A && git commit -m "..."
git push hf master:main
```

**Catatan penting:**
- `statement_cache_size=0` di engine — wajib untuk pgbouncer Transaction Pooler
- `birth_datetime` disimpan tanpa tzinfo (TIMESTAMP WITHOUT TIME ZONE), timezone disimpan terpisah
- Semua env vars (`CEREBRAS_API_KEY`, `DATABASE_URL`) harus di-set sebagai **Secrets** (bukan Variables) di HF Spaces Settings

---

## Status Saat Ini (2026-05-24 — update 6)

### Sudah Selesai ✅
- Kalkulasi semua pilar (Year, Month, Day, Hour)
- Ten Gods untuk 3 stem (year, month, hour vs day master)
- Day Master Strength calculation (bukan hardcoded)
- Interaksi: Clash + Six Combination + Six Harms + Three Penalties
- Frontend: navy + gold theme (konsisten dengan logo)
- Frontend: date/time picker native HTML untuk web, timezone preset WIB/WITA/WIT
- Frontend: bottom tab navigation (Kalender / Keinginan / Profil)
- Frontend: ChartContext — chartId & timezone persisten via AsyncStorage
- ProfileScreen: onboarding + chart view + 1 narasi section (Analisis Lengkap — comprehensive single-call)
- WishScreen: tulis keinginan + analisis BaZi via AI (Cerebras)
- CalendarScreen: kalender grid bulanan + pilar hari ini + interaksi (tanpa AI narasi otomatis)
- Backend: endpoint `/profile/{chart_id}` dengan cached narasi
- Backend: CRUD `/wishes` + `/wishes/{id}/analyze`
- Backend: `CachedNarasi` DB model — narasi di-cache per section
- UI redesign: shared `src/theme.ts` (amber-gold `#C8A83C`, warm text `#EDE8DB`)
- UI: ProfileScreen Day Master hero card, pillar grid, narasi topic buttons
- UI: CalendarScreen element color accents per pilar, badge interaksi
- UI: WishScreen input card, expandable wish cards
- Hapus AI narasi kalender harian (latency tinggi, nilai informasi rendah)
- Hapus: file lama — `App.nav.tsx`, `ChartScreen.tsx`, `OnboardingScreen.tsx`
- Deployment: backend di HF Spaces, frontend di Vercel, DB di Supabase
- AI narasi async dengan httpx, full pillar context dikirim ke Cerebras
- Fix: `FLG_MOSEPH` untuk ephemeris tanpa file eksternal
- Fix: `statement_cache_size=0` untuk pgbouncer compatibility
- Fix: `tzinfo=None` sebelum insert ke TIMESTAMP WITHOUT TIME ZONE
- Fix: semua `chart_id` pakai `str` bukan `UUID` (VARCHAR column mismatch)
- Fix: CORS `allow_credentials=False` (wildcard origin + credentials tidak valid)
- Fix: Day pillar anchor salah — Jan 1 2000 adalah jiazi 54 (戊午), bukan 0 (甲子); semua pilar hari kini akurat (diverifikasi vs chart Joey Yap)
- Logo: semua asset diganti dengan logo custom (sun navy+gold) — favicon, icon, android icons, splash
- Fix: narasi tab "Hubungan" & "Kekuatan" — error lama tersimpan di DB cache tanpa prefix "ERROR:"; `is_error_narasi` diperluas mendeteksi format lama; frontend tidak lagi cache error response; tombol "↻ Coba Lagi" muncul saat narasi gagal
- Fix: delete keinginan di web — `Alert.alert` multi-button broken di RN Web, pakai `window.confirm` (pola sama seperti Reset Profil)
- Feat: SambaNova AI cascade — `Meta-Llama-3.1-405B-Instruct` sebagai model utama, `Meta-Llama-3.3-70B-Instruct` sebagai fallback, lalu Cerebras cascade; env var `SAMBANOVA_API_KEY`
- Feat: CalendarScreen — "Hubungan dengan Chartmu" kini dilengkapi narasi AI (POST `/calendar/narasi`); auto-fetch saat ganti tanggal, reset otomatis, retry button jika error; tidak di-cache DB
- Fix: WishScreen — keinginan hilang saat refresh karena `ctxLoading` belum dicek; sekarang nunggu context selesai load sebelum fetch/render
- Fix: cascade AI di `services/cerebras.py` — semua error provider selain 400/422 sekarang lanjut ke model berikutnya, jadi SambaNova auth/model error tetap fallback ke Cerebras
- Fix: `/api/calendar/narasi` — `interactions` sekarang dinormalisasi dari dict/object supaya endpoint tidak 500 saat `detect_calendar_interactions` mengembalikan dict
- Update: prompt AI utama ditulis ulang menjadi mode struktural, strategis, dan dinamika waktu yang lebih klinis/taktis
- Update: prompt AI sekarang dipisah jadi 3 blok utama plus template payload yang konsisten di [bazi_prompt.md](bazi_prompt.md)
- Update: prompt AI disederhanakan lagi agar istilah teknis lebih mudah dipahami dan dijelaskan singkat jika dipakai
- Update: prompt AI profile diganti total ke `PROFILE_SYSTEM_PROMPT` — BaZi Strategic Analyst dengan 6 seksi + Life Strategy Snapshot; framing probabilistik wajib; single comprehensive call per chart; day_master dikirim lengkap (stem + element + polarity); max_tokens naik ke 2000
- Update: ProfileScreen — 5 tombol narasi digabung jadi 1 tombol "Analisis Lengkap"; backend narasi di-cache dengan key `full_analysis`
- Update: logo diganti dari logo.svg ke logo.png (web + native pakai Image component React Native)

### Belum Ada / Known Issues ⚠️
- **Tidak ada unit tests** — engine calculation belum ditest
- **Alembic migrations belum setup** — pakai `create_all()` (tables baru terbuat otomatis saat restart)
- **Hidden Stems Ten Gods** — belum diimplementasi
- **Tidak ada multi-user** — satu device = satu chart (tidak ada login/akun)

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
