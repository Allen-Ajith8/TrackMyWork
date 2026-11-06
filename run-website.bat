@echo off
REM ============================================================================
REM TrackMyWork - Run Website
REM ============================================================================
REM This batch file starts the Next.js development server
REM Run this file by double-clicking or from command prompt
REM ============================================================================

title TrackMyWork - Development Server
color 0A

echo.
echo  ████████╗██╗  ██╗███████╗    ██╗   ██╗██╗ ██████╗ ███╗   ██╗
echo  ╚══██╔══╝██║  ██║██╔════╝    ██║   ██║██║██╔═══██╗████╗  ██║
echo     ██║   ███████║█████╗      ██║   ██║██║██║   ██║██╔██╗ ██║
echo     ██║   ██╔══██║██╔══╝      ╚██╗ ██╔╝██║██║   ██║██║╚██╗██║
echo     ██║   ██║  ██║███████╗     ╚████╔╝ ██║╚██████╔╝██║ ╚████║
echo     ╚═╝   ╚═╝  ╚═╝╚══════╝      ╚═══╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
echo.
echo  Hackathon Management Ecosystem
echo  ============================================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    echo.
)

REM Check if .env.local exists
if not exist ".env.local" (
    echo ⚠️  WARNING: .env.local not found!
    echo    Copy .env.example to .env.local and fill in your credentials
    echo    Required: Supabase URL, Anon Key, Service Role Key
    echo.
)

echo Starting Next.js development server...
echo.
echo Server will be available at: http://localhost:3000
echo Press Ctrl+C to stop the server
echo.

REM Start the dev server
npm run dev