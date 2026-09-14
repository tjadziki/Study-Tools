@echo off
rem --- Starts the deck's two servers and leaves them running.
rem     start-deck.vbs launches this hidden. Run this file directly when you
rem     want to watch the output or find out why something did not start.
cd /d "%~dp0.."
title Term Command Deck
call npm run dev
