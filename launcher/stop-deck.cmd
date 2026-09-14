@echo off
rem --- Stops the deck's servers.
rem     Only needed when you want the ports back. Otherwise they idle at
rem     nothing and are gone after a restart.
echo Stopping the Term Command Deck...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5173,5174 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"
echo Stopped.
ping -n 3 127.0.0.1 >nul
