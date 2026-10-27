@echo off
cd /d "%~dp0"

attrib +h "%~dp0_internal" >nul 2>&1

powershell -ExecutionPolicy Bypass -File "%~dp0_internal\_workspace.ps1"
if errorlevel 1 ( pause & exit /b 1 )

ping -n 4 127.0.0.1 >nul 2>&1
start "" "http://localhost:8787"
