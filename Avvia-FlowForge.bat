@echo off
chcp 65001 >nul
title FlowForge
cd /d "%~dp0"

echo.
echo   ==============================
echo      Avvio di FlowForge...
echo   ==============================
echo.

REM Verifica che Node.js sia installato
where node >nul 2>nul
if errorlevel 1 (
  echo   [ERRORE] Node.js non e' installato.
  echo   Scaricalo da https://nodejs.org e riprova.
  echo.
  pause
  exit /b 1
)

REM Installa le dipendenze al primo avvio
if not exist "node_modules" (
  echo   Primo avvio: installazione dipendenze in corso...
  call npm install
  echo.
)

REM Apre il browser dopo 2 secondi (in parallelo all'avvio del server)
start "" /b cmd /c "timeout /t 2 >nul & start "" http://localhost:5678"

echo   Server in esecuzione. Chiudi questa finestra per fermare FlowForge.
echo.
node server.js

echo.
echo   FlowForge si e' arrestato.
pause
