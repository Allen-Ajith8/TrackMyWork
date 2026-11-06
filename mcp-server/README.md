# TrackMyWork MCP Server

Vibe Coding Telemetry server for TrackMyWork hackathon management ecosystem.

## Features

- **Real-time Heartbeat** - Purple pulsing dot on web dashboard when actively coding
- **File Lock Detection** - Warns when multiple IDE agents edit the same file
- **Environment Vault** - Securely pulls room-specific `.env` variables
- **Status Broadcasting** - Shares current vibe-coding prompt/status to room feed
- **SOS Debugging** - One-tap error analysis via DeepSeek-R1/Qwen Coder
- **Task Management** - Create tasks directly from IDE
- **Vibe Rollback** - Mark commits as "Working Demo Ready" for instant revert

## Quick Start

### 1. Install Dependencies

```bash
cd mcp-server
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Configure Environment

Copy `.env.example` to `.env` and fill in:

```bash
# Supabase (required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# NVIDIA NIM (required for SOS debugging)
NVIDIA_NIM_API_KEY=your-nim-api-key
NVIDIA_NIM_BASE_URL=https://integrate.api.nvidia.com/v1
NIM_MODEL_DEEPSEEK_R1=deepseek-ai/deepseek-r1

# Server ports
MCP_HTTP_PORT=3002
MCP_WS_PORT=3003
```

### 4. Run Development

```bash
npm run dev
```

## IDE Integration

### VS Code

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "trackmywork": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "${workspaceFolder}/mcp-server",
      "env": {
        "SUPABASE_URL": "${env:NEXT_PUBLIC_SUPABASE_URL}",
        "SUPABASE_SERVICE_ROLE_KEY": "${env:SUPABASE_SERVICE_ROLE_KEY}",
        "NVIDIA_NIM_API_KEY": "${env:NVIDIA_NIM_API_KEY}",
        "NVIDIA_NIM_BASE_URL": "${env:NVIDIA_NIM_BASE_URL}",
        "NIM_MODEL_DEEPSEEK_R1": "${env:NIM_MODEL_DEEPSEEK_R1}",
        "MCP_HTTP_PORT": "3002",
        "MCP_WS_PORT": "3003"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "trackmywork": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "${workspaceFolder}/mcp-server",
      "env": {
        "SUPABASE_URL": "${env:NEXT_PUBLIC_SUPABASE_URL}",
        "SUPABASE_SERVICE_ROLE_KEY": "${env:SUPABASE_SERVICE_ROLE_KEY}",
        "NVIDIA_NIM_API_KEY": "${env:NVIDIA_NIM_API_KEY}",
        "NVIDIA_NIM_BASE_URL": "${env:NVIDIA_NIM_BASE_URL}",
        "NIM_MODEL_DEEPSEEK_R1": "${env:NIM_MODEL_DEEPSEEK_R1}",
        "MCP_HTTP_PORT": "3002",
        "MCP_WS_PORT": "3003"
      }
    }
  }
}
```

### OpenCode

Add to `opencode-mcp.json`:

```json
{
  "mcp": {
    "servers": {
      "trackmywork": {
        "command": "node",
        "args": ["dist/index.js"],
        "cwd": "${workspaceFolder}/mcp-server",
        "env": {
          "SUPABASE_URL": "${env:NEXT_PUBLIC_SUPABASE_URL}",
          "SUPABASE_SERVICE_ROLE_KEY": "${env:SUPABASE_SERVICE_ROLE_KEY}",
          "NVIDIA_NIM_API_KEY": "${env:NVIDIA_NIM_API_KEY}",
          "NVIDIA_NIM_BASE_URL": "${env:NVIDIA_NIM_BASE_URL}",
          "NIM_MODEL_DEEPSEEK_R1": "${env:NIM_MODEL_DEEPSEEK_R1}",
          "MCP_HTTP_PORT": "3002",
          "MCP_WS_PORT": "3003"
        }
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `trackmywork_heartbeat` | Updates presence (purple pulsing dot) |
| `trackmywork_pull_env` | Fetches room `.env` variables |
| `trackmywork_status` | Broadcasts vibe-coding status |
| `trackmywork_get_context` | Gets room context (tasks, BOM, artifacts) |
| `trackmywork_create_task` | Creates a new task |
| `trackmywork_sos_debug` | Sends error to NIM for debugging |

## Available Resources

| Resource | Description |
|----------|-------------|
| `trackmywork://room/{room_id}/context` | Full room state |
| `trackmywork://user/{user_id}/permissions/{room_id}` | User permissions |
| `trackmywork://room/{room_id}/env` | Room environment variables |

## WebSocket Connection (Real-time)

The server runs a WebSocket server on port 3003 for real-time IDE telemetry:

```javascript
const ws = new WebSocket('ws://localhost:3003');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your-supabase-jwt',
    roomId: 'room-uuid',
    editor: 'vscode'
  }));
};

// Send heartbeat every 30 seconds
setInterval(() => {
  ws.send(JSON.stringify({
    type: 'heartbeat',
    filePath: 'src/components/Button.tsx',
    language: 'typescript'
  }));
}, 30000);

// Listen for conflicts
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'file_lock_conflict') {
    console.warn(`⚠️ Conflict on ${msg.filePath}: ${msg.otherUser} is editing`);
  }
};
```

## Usage Examples

### Heartbeat (Auto-called by IDE extension)

```typescript
// Called automatically when you start editing
await mcp.callTool('trackmywork_heartbeat', {
  room_id: 'uuid',
  user_id: 'uuid',
  editor_type: 'vscode',
  file_path: 'src/app/page.tsx',
  language: 'typescript'
});
```

### Pull Environment Variables

```typescript
const env = await mcp.callTool('trackmywork_pull_env', {
  room_id: 'uuid',
  user_id: 'uuid'
});
// Returns: "NVIDIA_NIM_API_KEY=...\nSUPABASE_URL=...\n..."
```

### Broadcast Status

```typescript
await mcp.callTool('trackmywork_status', {
  room_id: 'uuid',
  user_id: 'uuid',
  status: 'Implementing user authentication with NextAuth',
  editor_type: 'vscode'
});
```

### SOS Debug

```typescript
const analysis = await mcp.callTool('trackmywork_sos_debug', {
  room_id: 'uuid',
  user_id: 'uuid',
  error_log: 'error: cannot find module...',
  context: 'rust_compiler',
  relevant_files: ['src/main.rs', 'Cargo.toml']
});
```

## Architecture

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│  IDE Client     │ ◄─────────────────► │  MCP Server      │
│  (VS Code/      │     Port 3003       │  (Node.js/TS)    │
│   Cursor/       │                     │                  │
│   OpenCode)     │                     │  ┌────────────┐  │
└─────────────────┘                     │  │ Supabase   │  │
                                        │  │ PostgreSQL │  │
                                        │  │ Realtime   │  │
                                        │  └────────────┘  │
                                        │  ┌────────────┐  │
                                        │  │ NVIDIA NIM │  │
                                        │  │ (DeepSeek  │  │
                                        │  │  /Qwen)    │  │
                                        │  └────────────┘  │
                                        └──────────────────┘
```

## Production Deployment

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
EXPOSE 3002 3003
CMD ["node", "dist/index.js"]
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key |
| `NVIDIA_NIM_API_KEY` | Yes | NIM API key |
| `NVIDIA_NIM_BASE_URL` | No | Default: `https://integrate.api.nvidia.com/v1` |
| `NIM_MODEL_DEEPSEEK_R1` | No | Default: `deepseek-ai/deepseek-r1` |
| `MCP_HTTP_PORT` | No | Default: `3002` |
| `MCP_WS_PORT` | No | Default: `3003` |

## Troubleshooting

### "Missing Supabase credentials"
Ensure `.env` file exists with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

### WebSocket connection fails
Check firewall allows port 3003. Verify `MCP_WS_PORT` matches.

### NIM API errors
Verify `NVIDIA_NIM_API_KEY` is valid and has access to required models.

### Purple dot not showing
1. Check heartbeat tool is being called
2. Verify `vibe_heartbeats` table has recent entries
3. Check Supabase Realtime is enabled for `vibe_heartbeats`

## License

MIT - Built for hackathons, by hackathon veterans.