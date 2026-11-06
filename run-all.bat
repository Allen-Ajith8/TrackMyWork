@echo off
REM ============================================================================
REM TrackMyWork - Run Everything (Website + MCP Server)
REM ============================================================================
REM This batch file starts both the Next.js dev server and MCP server
REM in separate command prompt windows
REM ============================================================================

title TrackMyWork - Full Stack
color 0B

echo.
echo  ████████╗██╗  ██╗███████╗    ██╗   ██╗██╗ ██████╗ ███╗   ██╗
echo  ╚══██╔══╝██║  ██║██╔════╝    ██║   ██║██║██╔═══██╗████╗  ██║
echo     ██║   ███████║█████╗      ██║   ██║██║██║   ██║██╔██╗ ██║
echo     ██║   ██╔══██║██╔══╝      ╚██╗ ██╔╝██║██║   ██║██║╚██╗██║
echo     ██║   ██║  ██║███████╗     ╚████╔╝ ██║╚██████╔╝██║ ╚████║
echo     ╚═╝   ╚═╝  ╚═╝╚══════╝      ╚═══╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
echo.
echo  Starting Full Stack: Website + MCP Server
echo  ============================================================
echo.

REM Check if .env.local exists
if not exist ".env.local" (
    echo ⚠️  WARNING: .env.local not found!
    echo    Copy .env.example to .env.local and fill in your credentials
    echo.
)

REM Check MCP server .env
if not exist "mcp-server\.env" (
    echo ⚠️  WARNING: mcp-server\.env not found!
    echo    Copy mcp-server\.env.example to mcp-server\.env and fill in credentials
    echo.
)

echo.
echo Starting Website (Next.js) on http://localhost:3000
echo Starting MCP Server on ws://localhost:3003
echo.
echo Two separate windows will open. Press Ctrl+C in each to stop.
echo.

REM Start Website in new window
start "TrackMyWork - Website" cmd /k "cd /d "%~dp0" && npm run dev"

REM Wait a moment
timeout /t 2 /nobreak >nul

REM Start MCP Server in new window
start "TrackMyWork - MCP Server" cmd /k "cd /d "%~dp0mcp-server" && npm run dev"

echo.
echo ✅ Both servers started!
echo    Website:    http://localhost:3000
echo    MCP WS:     ws://localhost:3003
echo    MCP HTTP:   http://localhost:3002
echo.
echo Close the terminal windows to stop the servers.
pause