# Panduan Deployment BaZi App

## Gambaran Umum — GRATIS, tanpa kartu kredit

| Komponen | Platform | Biaya |
|---|---|---|
| Backend (FastAPI) | **Render** | Gratis (tidur 15 mnt idle, wake ~30 dtk) |
| Database | **Supabase** PostgreSQL | Gratis, data permanen |
| Frontend Web (Laptop/Browser) | **Vercel** | Gratis |
| Mobile (HP Android) | **EAS Build** + Install APK | Gratis |

---

## LANGKAH 1: Setup Database di Supabase

1. Buka [supabase.com](https://supabase.com) → Sign up dengan GitHub
2. Klik **"New project"**
   - Name: `bazi-app`
   - Password: buat password database (catat!)
   - Region: **Southeast Asia (Singapore)**
3. Tunggu project ready (~2 menit)
4. Buka **Settings** → **Database** → scroll ke **Connection string**
5. Pilih tab **URI**, copy string-nya (bentuknya seperti ini):
   ```
   postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres
   ```
6. Simpan string ini — akan dipakai di Langkah 2.

---

## LANGKAH 2: Deploy Backend ke Render

1. Buka [render.com](https://render.com) → Sign up dengan GitHub (gratis, tanpa CC)
2. Klik **"New +"** → **"Web Service"**
3. Pilih repo `bazi-app`
4. Isi konfigurasi:
   - **Name:** `bazi-backend`
   - **Root Directory:** `backend`
   - **Environment:** `Docker`
   - **Instance Type:** `Free`
5. Di bagian **Environment Variables**, klik **"Add Environment Variable"** dua kali:
   ```
   CEREBRAS_API_KEY = [API key Cerebras kamu]
   DATABASE_URL     = [Connection string Supabase dari Langkah 1]
   ```
6. Klik **"Create Web Service"** → tunggu build ~5-10 menit
7. Setelah selesai, Render beri URL seperti: `https://bazi-backend.onrender.com`

**Test — buka di browser:**
```
https://bazi-backend.onrender.com/
```
Harus muncul: `{"message": "BaZi API is running"}`

---

## LANGKAH 3: Update URL Backend di Frontend

Edit file `bazi-app/eas.json`, ganti `YOUR_RAILWAY_URL` di kedua tempat dengan URL Render:
```json
"EXPO_PUBLIC_API_URL": "https://bazi-backend.onrender.com/api"
```

Lalu push ke GitHub:
```powershell
cd "c:\Users\sam\Documents\kerja\Self app"
git add bazi-app/eas.json
git commit -m "update: backend url ke render"
git push
```

---

## LANGKAH 4: Deploy Frontend Web ke Vercel

1. Buka [vercel.com](https://vercel.com) → Sign up dengan GitHub (gratis)
2. Klik **"New Project"** → import repo `bazi-app`
3. Set **Root Directory** ke `bazi-app`
4. **Framework Preset:** pilih **Other**
5. Di bagian **Environment Variables**, tambahkan:
   ```
   EXPO_PUBLIC_API_URL = https://bazi-backend.onrender.com/api
   ```
6. Klik **"Deploy"** → tunggu ~2-3 menit
7. Vercel beri URL seperti `https://bazi-app-xxx.vercel.app`

**Akses dari laptop atau browser HP:** Buka URL Vercel.

---

## LANGKAH 5: Build APK untuk HP Android

### Install tools (sekali saja)
```powershell
npm install -g eas-cli
eas login
```
Daftar akun di [expo.dev](https://expo.dev) (gratis, tanpa CC).

### Build APK
```powershell
cd "c:\Users\sam\Documents\kerja\Self app\bazi-app"
eas build --platform android --profile preview
```

- Build dilakukan di cloud Expo, laptop tidak perlu nyala terus
- Selesai ~10-15 menit
- EAS kirim email + link download APK

### Install di HP Android
1. Download APK dari link EAS (atau kirim via WhatsApp ke diri sendiri)
2. Di HP: Settings → Security → aktifkan **"Install unknown apps"**
3. Buka file APK → Install

---

## Catatan Penting

### Render Sleep
Backend tidur setelah 15 menit tidak ada request. Buka app pertama kali setelah lama → loading ~30 detik. Setelah itu normal.

### API Key Cerebras
Jika API key lama sudah ter-expose, generate key baru di:
[inference.cerebras.ai](https://inference.cerebras.ai) → Login → API Keys → Create new key

### Update App Setelah Ini
- Backend berubah → push ke GitHub → Render auto-redeploy
- Frontend web berubah → push ke GitHub → Vercel auto-redeploy
- UI mobile berubah → `eas build` ulang → install APK baru di HP

---

## Quick Reference

| | URL |
|---|---|
| Backend API | `https://bazi-backend.onrender.com` |
| Frontend Web | `https://bazi-app-xxx.vercel.app` |
| Database | [supabase.com](https://supabase.com) dashboard |
| APK | Link dari email EAS Build |
