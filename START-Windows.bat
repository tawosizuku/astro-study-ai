@echo off
cd /d "%~dp0"

attrib +h "%~dp0_internal" >nul 2>&1

powershell -ExecutionPolicy Bypass -File "%~dp0_internal\_workspace.ps1"
if errorlevel 1 ( pause & exit /b 1 )

REM _workspace.ps1 returns only once the server answers, so no fixed delay is needed here
start "" "http://localhost:8787"
