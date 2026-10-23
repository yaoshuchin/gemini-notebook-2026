@echo off
chcp 65001 >nul
title 1151028 亮亮師 - GeminiNoteBook2026 本地伺服器
echo ========================================================
echo   從資料到工具 三段式開發實戰
echo   Gemini Notebook × AI 規格化 × Vibe Coding
echo ========================================================
echo.
echo 正在啟動本地伺服器：http://localhost:8080 ...
echo 瀏覽器將自動開啟首頁，按 Ctrl+C 可停止伺服器。
echo.

start "" "http://localhost:8080/index.html"
python -m http.server 8080
if %ERRORLEVEL% NEQ 0 (
    echo Python 未安裝或啟動失敗，嘗試使用 npx serve...
    npx serve -l 8080 .
)
pause
