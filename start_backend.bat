cd "c:\Users\sam\Documents\kerja\Self app\backend"
echo "Menjalankan Backend BaZi App..."
"venv\Scripts\uvicorn.exe" main:app --host 0.0.0.0 --port 8000 --reload
pause
