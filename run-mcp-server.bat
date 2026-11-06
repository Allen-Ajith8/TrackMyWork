@echo off
REM ============================================================================
REM TrackMyWork - Run MCP Server (Vibe Coding Telemetry)
REM ============================================================================
REM This batch file starts the MCP server for IDE integration
REM Run this in a separate terminal window
REM ============================================================================

title TrackMyWork - MCP Server
color 0D

echo.
echo  ███╗   ███╗ █████╗ ██████╗ ███████╗
echo  ████╗ ████║██╔══██╗██╔══██╗██╔════╝
echo  ██╔████╔██║███████║██████╔╝█████╗
echo  ██║╚██╔╝██║██╔══██║██╔══██╗██╔══╝
echo  ██║ ╚═╝ ██║██║  ██║██║  ██║███████╗
echo  ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝
echo.
echo  MCP Server - Vibe Coding Telemetry
echo  ============================================================
echo.

cd mcp-server

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing MCP server dependencies...
    npm install
    echo.
)

REM Check if .env exists
if not exist ".env" (
    echo ⚠️  WARNING: .env not found in mcp-server!
    echo    Copy .env.example to .env and fill in your credentials
    echo    Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NVIDIA_NIM_API_KEY
    echo.
)

REM Build TypeScript
echo Building TypeScript...
npm run build
echo.

echo Starting MCP Server...
echo.
echo MCP Server (stdio): Ready for IDE connections (VS Code, Cursor, OpenCode)
echo WebSocket Server: ws://localhost:3003 (for real-time IDE telemetry)
echo HTTP Server: http://localhost:3002 (for API calls)
echo Press Ctrl+C to stop the server
echo.

REM Start the dev server
npm run dev