// ============================================================================
// TrackMyWork - MCP Server (Vibe Coding Telemetry)
// Complete implementation with @modelcontextprotocol/sdk
// Run with: cd mcp-server && npm run dev
// ============================================================================

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@supabase/supabase-js';
import { WebSocketServer, WebSocket } from 'ws';
import { z } from 'zod';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MCP_HTTP_PORT = parseInt(process.env.MCP_HTTP_PORT || '3002', 10);
const MCP_WS_PORT = parseInt(process.env.MCP_WS_PORT || '3003', 10);
const MCP_REQUIRE_AUTH = ['1', 'true', 'yes'].includes(
  (process.env.MCP_REQUIRE_AUTH || '').toLowerCase()
);

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Stdio tools run with the service-role key, so without verification any local
 * caller could act as another user by passing an arbitrary `user_id`. When an
 * `auth_token` (Supabase access token) is supplied we verify it and require it
 * to belong to the claimed user. Set MCP_REQUIRE_AUTH=true to reject calls that
 * do not present a token at all.
 */
async function resolveActingUser(args: {
  user_id?: string;
  auth_token?: string;
}): Promise<string> {
  const token = args.auth_token?.trim();

  if (!token) {
    if (MCP_REQUIRE_AUTH) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Missing auth_token. Sign in to TrackMyWork and pass your Supabase access token, or set MCP_REQUIRE_AUTH=false for local-only use.'
      );
    }
    if (!args.user_id) {
      throw new McpError(ErrorCode.InvalidParams, 'Missing user_id.');
    }
    return args.user_id;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new McpError(ErrorCode.InvalidParams, 'Invalid or expired auth_token.');
  }

  if (args.user_id && args.user_id !== user.id) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'auth_token does not belong to the supplied user_id.'
    );
  }

  return user.id;
}

/** Tools that write room telemetry must only accept active room members. */
async function assertRoomMember(roomId: string, userId: string) {
  const { data: member } = await supabase
    .from('room_members')
    .select('id')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (!member) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'User is not an active member of this room.'
    );
  }
}

// ---------------------------------------------------------------------------
// AI Courtroom rulings (closed-loop Phase 6)
// Adopted courtroom options carry `agents_md_rules`; every IDE agent that asks
// for room context must receive them as hard architectural constraints.
// ---------------------------------------------------------------------------

interface AdoptedCourtroomRuling {
  session_id: string;
  motion: string;
  adopted_option_id: string | null;
  adopted_at: string;
  option_title: string;
  rules: string[];
}

interface CourtroomOptionShape {
  id?: string;
  title?: string;
  agents_md_rules?: string[];
}

async function loadCourtroomRulings(roomId: string): Promise<AdoptedCourtroomRuling[]> {
  const { data: sessions } = await supabase
    .from('court_sessions')
    .select('id, motion, adopted_option_id, decision_options, updated_at')
    .eq('room_id', roomId)
    .eq('status', 'adopted')
    .order('updated_at', { ascending: false });

  return (sessions ?? []).map((session) => {
    const options = Array.isArray(session.decision_options)
      ? (session.decision_options as CourtroomOptionShape[])
      : [];
    const selected = options.find((option) => option?.id === session.adopted_option_id);
    const rules = Array.isArray(selected?.agents_md_rules)
      ? selected!.agents_md_rules!.filter(Boolean)
      : [];

    return {
      session_id: session.id as string,
      motion: session.motion as string,
      adopted_option_id: (session.adopted_option_id as string | null) ?? null,
      adopted_at: session.updated_at as string,
      option_title:
        selected?.title || (session.adopted_option_id as string | null) || 'Adopted ruling',
      rules,
    };
  });
}

function buildCourtroomRulingsSection(rulings: AdoptedCourtroomRuling[]): string {
  const lines: string[] = ['## Active AI Courtroom Rulings (AGENTS.md Constraints)', ''];

  if (rulings.length === 0) {
    lines.push(
      '- No adopted courtroom rulings yet. Defer to the room rules above and ask the team before architectural changes.'
    );
    return lines.join('\n');
  }

  lines.push(
    'These architectural decisions were adopted in the AI Courtroom. Treat them as hard constraints:',
    ''
  );

  for (const ruling of rulings) {
    lines.push(`### ${ruling.option_title}`);
    lines.push(`- Motion: ${ruling.motion}`);
    lines.push(`- Adopted: ${ruling.adopted_at}`);
    if (ruling.rules.length > 0) {
      lines.push('- Constraints:');
      for (const rule of ruling.rules) {
        lines.push(`  - ${rule}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

// WebSocket server for real-time IDE connections
const wss = new WebSocketServer({ port: MCP_WS_PORT });
const ideConnections = new Map<string, { ws: WebSocket; roomId: string; userId: string; editor: string }>();

wss.on('connection', (ws, req) => {
  console.log(`[MCP] New IDE connection from ${req.socket.remoteAddress}`);

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case 'auth': {
          // Verify JWT token
          const { data: { user }, error } = await supabase.auth.getUser(msg.token);
          if (error || !user) {
            ws.send(JSON.stringify({ type: 'auth_error', error: 'Invalid token' }));
            ws.close();
            return;
          }

          // Only active room members may stream telemetry into a room.
          const { data: member } = await supabase
            .from('room_members')
            .select('id')
            .eq('room_id', msg.roomId)
            .eq('user_id', user.id)
            .eq('status', 'active')
            .maybeSingle();

          if (!member) {
            ws.send(JSON.stringify({ type: 'auth_error', error: 'Not a member of this room' }));
            ws.close();
            return;
          }

          ideConnections.set(user.id, {
            ws,
            roomId: msg.roomId,
            userId: user.id,
            editor: msg.editor || 'unknown',
          });
          ws.send(JSON.stringify({ type: 'auth_ok', userId: user.id }));
          console.log(`[MCP] Authenticated user ${user.id} for room ${msg.roomId} (${msg.editor})`);
          break;
        }

        case 'heartbeat': {
          const conn = Array.from(ideConnections.values()).find(c => c.ws === ws);
          if (conn) {
            await supabase.from('vibe_heartbeats').upsert({
              room_id: conn.roomId,
              user_id: conn.userId,
              editor_type: conn.editor,
              file_path: msg.filePath || null,
              language: msg.language || null,
              last_heartbeat: new Date().toISOString(),
            }, { onConflict: 'room_id,user_id,editor_type' });

            // Broadcast to other IDE clients in same room
            broadcastToRoom(conn.roomId, {
              type: 'heartbeat_update',
              userId: conn.userId,
              editor: conn.editor,
              filePath: msg.filePath,
              language: msg.language,
              timestamp: new Date().toISOString(),
            }, ws);
          }
          break;
        }

        case 'file_lock': {
          const conn = Array.from(ideConnections.values()).find(c => c.ws === ws);
          if (conn) {
            const { data: existing } = await supabase
              .from('file_locks')
              .select('user_id, users(username)')
              .eq('room_id', conn.roomId)
              .eq('file_path', msg.filePath)
              .single();

            if (existing && existing.user_id !== conn.userId) {
              // Conflict! Warn both users
              ws.send(JSON.stringify({
                type: 'file_lock_conflict',
                filePath: msg.filePath,
                otherUser: existing.users?.username,
              }));

              // Also notify the other user if connected
              const otherConn = Array.from(ideConnections.values()).find(c => c.userId === existing.user_id);
              if (otherConn) {
                otherConn.ws.send(JSON.stringify({
                  type: 'file_lock_conflict',
                  filePath: msg.filePath,
                  otherUser: conn.editor,
                }));
              }
            }

            await supabase.from('file_locks').upsert({
              room_id: conn.roomId,
              user_id: conn.userId,
              file_path: msg.filePath,
              editor_type: conn.editor,
              locked_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            }, { onConflict: 'room_id,file_path' });

            broadcastToRoom(conn.roomId, {
              type: 'file_locked',
              filePath: msg.filePath,
              userId: conn.userId,
              editor: conn.editor,
            }, ws);
          }
          break;
        }

        case 'file_unlock': {
          const conn = Array.from(ideConnections.values()).find(c => c.ws === ws);
          if (conn) {
            await supabase
              .from('file_locks')
              .delete()
              .eq('room_id', conn.roomId)
              .eq('file_path', msg.filePath)
              .eq('user_id', conn.userId);

            broadcastToRoom(conn.roomId, {
              type: 'file_unlocked',
              filePath: msg.filePath,
              userId: conn.userId,
            }, ws);
          }
          break;
        }

        case 'vibe_rollback': {
          const conn = Array.from(ideConnections.values()).find(c => c.ws === ws);
          if (conn) {
            await supabase.from('vibe_rollbacks').insert({
              room_id: conn.roomId,
              commit_sha: msg.commitSha,
              commit_message: msg.commitMessage,
              branch_name: msg.branch || 'main',
              labeled_by: conn.userId,
              label: msg.label || 'Working Demo Ready',
            });
            ws.send(JSON.stringify({ type: 'vibe_rollback_ok', commitSha: msg.commitSha }));
          }
          break;
        }

        case 'status_update': {
          const conn = Array.from(ideConnections.values()).find(c => c.ws === ws);
          if (conn) {
            broadcastToRoom(conn.roomId, {
              type: 'status_update',
              userId: conn.userId,
              editor: conn.editor,
              status: msg.status,
              timestamp: new Date().toISOString(),
            }, ws);
          }
          break;
        }
      }
    } catch (e) {
      console.error('[MCP] WS message error:', e);
    }
  });

  ws.on('close', () => {
    for (const [userId, conn] of ideConnections) {
      if (conn.ws === ws) {
        ideConnections.delete(userId);
        console.log(`[MCP] IDE disconnected: ${userId}`);
        break;
      }
    }
  });

  ws.on('error', (err) => {
    console.error('[MCP] WS error:', err);
  });
});

function broadcastToRoom(roomId: string, message: object, excludeWs?: WebSocket) {
  for (const conn of ideConnections.values()) {
    if (conn.roomId === roomId && conn.ws !== excludeWs && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify(message));
    }
  }
}

console.log(`[MCP] WebSocket server running on port ${MCP_WS_PORT}`);

// MCP Server for tool calling via stdio
const server = new Server(
  {
    name: 'trackmywork-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Tool: trackmywork_heartbeat - Updates Supabase Realtime presence
const heartbeatSchema = z.object({
  room_id: z.string().uuid(),
  user_id: z.string().uuid(),
  auth_token: z.string().optional(),
  editor_type: z.enum(['vscode', 'cursor', 'android-studio', 'opencode', 'other']),
  file_path: z.string().optional(),
  language: z.string().optional(),
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'trackmywork_heartbeat',
      description: 'Updates Supabase Realtime presence to trigger the Purple Pulsing Dot on the web dashboard',
      inputSchema: {
        type: 'object',
        properties: {
          room_id: { type: 'string', format: 'uuid', description: 'Room UUID' },
          user_id: { type: 'string', format: 'uuid', description: 'User UUID' },
          auth_token: { type: 'string', description: 'Supabase access token for the user (required when MCP_REQUIRE_AUTH=true)' },
          editor_type: { type: 'string', enum: ['vscode', 'cursor', 'android-studio', 'opencode', 'other'], description: 'IDE/Editor type' },
          file_path: { type: 'string', description: 'Current file being edited' },
          language: { type: 'string', description: 'Programming language' },
        },
        required: ['room_id', 'user_id', 'editor_type'],
      },
    },
    {
      name: 'trackmywork_pull_env',
      description: 'Fetches the room\'s secure .env variables from Supabase vault',
      inputSchema: {
        type: 'object',
        properties: {
          room_id: { type: 'string', format: 'uuid', description: 'Room UUID' },
          user_id: { type: 'string', format: 'uuid', description: 'User UUID (must have can_trigger_nim permission)' },
          auth_token: { type: 'string', description: 'Supabase access token for the user (required when MCP_REQUIRE_AUTH=true)' },
        },
        required: ['room_id', 'user_id'],
      },
    },
    {
      name: 'trackmywork_status',
      description: 'Broadcasts the current vibe-coding prompt/status to the room feed',
      inputSchema: {
        type: 'object',
        properties: {
          room_id: { type: 'string', format: 'uuid', description: 'Room UUID' },
          user_id: { type: 'string', format: 'uuid', description: 'User UUID' },
          auth_token: { type: 'string', description: 'Supabase access token for the user (required when MCP_REQUIRE_AUTH=true)' },
          status: { type: 'string', description: 'Current vibe-coding status/prompt' },
          editor_type: { type: 'string', enum: ['vscode', 'cursor', 'android-studio', 'opencode', 'other'] },
        },
        required: ['room_id', 'user_id', 'status'],
      },
    },
    {
      name: 'trackmywork_get_context',
      description:
        'Get current room context including members, tasks, rules, settings, and adopted AI Courtroom rulings (AGENTS.md constraints)',
      inputSchema: {
        type: 'object',
        properties: {
          room_id: { type: 'string', format: 'uuid', description: 'Room UUID' },
          user_id: { type: 'string', format: 'uuid', description: 'User UUID' },
          auth_token: { type: 'string', description: 'Supabase access token for the user (required when MCP_REQUIRE_AUTH=true)' },
        },
        required: ['room_id', 'user_id'],
      },
    },
    {
      name: 'trackmywork_create_task',
      description: 'Create a new task in a room',
      inputSchema: {
        type: 'object',
        properties: {
          room_id: { type: 'string', format: 'uuid' },
          user_id: { type: 'string', format: 'uuid' },
          auth_token: { type: 'string', description: 'Supabase access token for the user (required when MCP_REQUIRE_AUTH=true)' },
          title: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string', enum: ['code', 'hardware', 'animation', 'design', 'docs', 'pitch'] },
          assigned_to: { type: 'string', format: 'uuid' }.optional(),
        },
        required: ['room_id', 'user_id', 'title'],
      },
    },
    {
      name: 'trackmywork_sos_debug',
      description: 'Send error log to NIM for debugging (SOS button)',
      inputSchema: {
        type: 'object',
        properties: {
          room_id: { type: 'string', format: 'uuid' },
          user_id: { type: 'string', format: 'uuid' },
          auth_token: { type: 'string', description: 'Supabase access token for the user (required when MCP_REQUIRE_AUTH=true)' },
          error_log: { type: 'string' },
          context: { type: 'string', enum: ['android_logcat', 'rust_compiler', 'flutter_build', 'general'] },
          relevant_files: { type: 'array', items: { type: 'string' } },
        },
        required: ['room_id', 'user_id', 'error_log', 'context'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'trackmywork_heartbeat': {
        const parsed = heartbeatSchema.parse(args);
        const userId = await resolveActingUser({
          user_id: parsed.user_id,
          auth_token: parsed.auth_token,
        });
        await assertRoomMember(parsed.room_id, userId);

        await supabase.from('vibe_heartbeats').upsert({
          room_id: parsed.room_id,
          user_id: userId,
          editor_type: parsed.editor_type,
          file_path: parsed.file_path || null,
          language: parsed.language || null,
          last_heartbeat: new Date().toISOString(),
        }, { onConflict: 'room_id,user_id,editor_type' });

        return {
          content: [{ type: 'text', text: `Heartbeat updated for user ${userId} in room ${parsed.room_id}` }],
        };
      }

      case 'trackmywork_pull_env': {
        const { room_id, user_id, auth_token } = args as {
          room_id: string;
          user_id: string;
          auth_token?: string;
        };
        const actingUserId = await resolveActingUser({ user_id, auth_token });

        // Verify user has permission
        const { data: member } = await supabase
          .from('room_members')
          .select('flag_can_trigger_nim, flag_is_team_leader')
          .eq('room_id', room_id)
          .eq('user_id', actingUserId)
          .eq('status', 'active')
          .single();

        if (!member || (!member.flag_can_trigger_nim && !member.flag_is_team_leader)) {
          throw new McpError(ErrorCode.InvalidParams, 'User lacks permission to pull environment variables');
        }

        // Fetch master integrations
        const { data: masterIntegrations } = await supabase
          .from('master_integrations')
          .select('name, config')
          .eq('is_active', true);

        // Fetch room-specific integrations
        const { data: roomIntegrations } = await supabase
          .from('room_integrations')
          .select('integration_name, config')
          .eq('room_id', room_id)
          .eq('is_active', true);

        // Merge configs (room overrides master)
        const envConfig: Record<string, string> = {};

        for (const int of masterIntegrations || []) {
          if (int.config) {
            Object.assign(envConfig, int.config);
          }
        }

        for (const int of roomIntegrations || []) {
          if (int.config) {
            Object.assign(envConfig, int.config);
          }
        }

        // Format as .env content
        const envLines = Object.entries(envConfig).map(([key, value]) => `${key}=${value}`);
        const envContent = envLines.join('\n');

        return {
          content: [{ type: 'text', text: envContent }],
        };
      }

      case 'trackmywork_status': {
        const { room_id, user_id, status, editor_type, auth_token } = args as {
          room_id: string;
          user_id: string;
          status: string;
          editor_type: string;
          auth_token?: string;
        };
        const actingUserId = await resolveActingUser({ user_id, auth_token });
        await assertRoomMember(room_id, actingUserId);

        // Broadcast to WebSocket clients
        const message = JSON.stringify({
          type: 'status_update',
          userId: actingUserId,
          editor: editor_type || 'unknown',
          status,
          timestamp: new Date().toISOString(),
        });

        for (const conn of ideConnections.values()) {
          if (conn.roomId === room_id && conn.ws.readyState === WebSocket.OPEN) {
            conn.ws.send(message);
          }
        }

        // Notify the rest of the room, not just the person who sent the update.
        const { data: roomMembers } = await supabase
          .from('room_members')
          .select('user_id')
          .eq('room_id', room_id)
          .eq('status', 'active');

        const recipients = (roomMembers ?? [])
          .map((member) => member.user_id as string)
          .filter((recipientId) => recipientId !== actingUserId);

        if (recipients.length > 0) {
          await supabase.from('notifications').insert(
            recipients.map((recipientId) => ({
              user_id: recipientId,
              room_id,
              type: 'webhook',
              title: `Vibe Status: ${status.slice(0, 50)}${status.length > 50 ? '...' : ''}`,
              content: {
                status,
                editor_type,
                user_id: actingUserId,
                timestamp: new Date().toISOString(),
              },
              action_url: `/dashboard/rooms/${room_id}`,
            }))
          );
        }

        return {
          content: [{ type: 'text', text: `Status broadcasted to room ${room_id}` }],
        };
      }

      case 'trackmywork_get_context': {
        const { room_id, user_id, auth_token } = args as {
          room_id: string;
          user_id: string;
          auth_token?: string;
        };
        const actingUserId = await resolveActingUser({ user_id, auth_token });
        await assertRoomMember(room_id, actingUserId);

        const { data: room } = await supabase
          .from('rooms')
          .select('*, room_rules(*), room_members(*, users(*))')
          .eq('id', room_id)
          .single();

        const { data: tasks } = await supabase
          .from('tasks')
          .select('*')
          .eq('room_id', room_id)
          .order('created_at', { ascending: false })
          .limit(20);

        const { data: bom } = await supabase
          .from('hardware_bom')
          .select('*')
          .eq('room_id', room_id)
          .order('created_at', { ascending: false });

        const { data: artifacts } = await supabase
          .from('artifacts')
          .select('*')
          .eq('room_id', room_id)
          .order('created_at', { ascending: false })
          .limit(10);

        const courtroomRulings = await loadCourtroomRulings(room_id);
        const agentsMdConstraints = buildCourtroomRulingsSection(courtroomRulings);

        return {
          content: [
            {
              type: 'text',
              text: `${agentsMdConstraints}\n\n---\n\n${JSON.stringify(
                {
                  room,
                  tasks,
                  bom,
                  artifacts,
                  courtroom_rulings: courtroomRulings,
                  agents_md_constraints: agentsMdConstraints,
                },
                null,
                2
              )}`,
            },
          ],
        };
      }

      case 'trackmywork_create_task': {
        const { room_id, user_id, title, description, category, assigned_to, auth_token } = args as {
          room_id: string;
          user_id: string;
          title: string;
          description?: string;
          category: string;
          assigned_to?: string;
          auth_token?: string;
        };
        const actingUserId = await resolveActingUser({ user_id, auth_token });

        // Verify permission
        const { data: member } = await supabase
          .from('room_members')
          .select('flag_can_assign_tasks, flag_is_team_leader')
          .eq('room_id', room_id)
          .eq('user_id', actingUserId)
          .eq('status', 'active')
          .single();

        if (!member || (!member.flag_can_assign_tasks && !member.flag_is_team_leader)) {
          throw new McpError(ErrorCode.InvalidParams, 'User lacks permission to create tasks');
        }

        const { data: task, error } = await supabase
          .from('tasks')
          .insert({
            room_id,
            created_by: actingUserId,
            title,
            description,
            category,
            assigned_to,
          })
          .select()
          .single();

        if (error) throw error;

        return {
          content: [{ type: 'text', text: `Task created: ${task.id} - ${task.title}` }],
        };
      }

      case 'trackmywork_sos_debug': {
        const { room_id, user_id, error_log, context, relevant_files, auth_token } = args as {
          room_id: string;
          user_id: string;
          error_log: string;
          context: 'android_logcat' | 'rust_compiler' | 'flutter_build' | 'general';
          relevant_files: string[];
          auth_token?: string;
        };
        const actingUserId = await resolveActingUser({ user_id, auth_token });

        // Verify permission
        const { data: member } = await supabase
          .from('room_members')
          .select('flag_can_trigger_nim, flag_is_team_leader')
          .eq('room_id', room_id)
          .eq('user_id', actingUserId)
          .eq('status', 'active')
          .single();

        if (!member || (!member.flag_can_trigger_nim && !member.flag_is_team_leader)) {
          throw new McpError(ErrorCode.InvalidParams, 'User lacks permission to trigger SOS debug');
        }

        // Call NIM API (same logic as /api/nim/sos)
        const NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY!;
        const NIM_BASE_URL = process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1';
        const DEEPSEEK_MODEL = process.env.NIM_MODEL_DEEPSEEK_R1 || 'deepseek-ai/deepseek-r1';

        const systemPrompts: Record<string, string> = {
          android_logcat: `You are an expert Android developer debugging Logcat output. Analyze the error log and provide:
1. Root cause analysis
2. Specific fix with code changes
3. Gradle/build commands to run
4. Prevention tips`,
          rust_compiler: `You are an expert Rust developer debugging compiler errors. Analyze the error and provide:
1. Root cause (borrow checker, type mismatch, lifetime, etc.)
2. Minimal fix with code example
3. Cargo commands to verify
4. Best practices to avoid this`,
          flutter_build: `You are an expert Flutter developer debugging build errors. Analyze and provide:
1. Root cause (dependency, platform, syntax, etc.)
2. Fix with code changes
3. Flutter/pub commands to run
4. Prevention tips`,
          general: `You are an expert software engineer debugging an error. Provide:
1. Root cause analysis
2. Step-by-step fix
3. Commands to verify
4. Prevention tips`,
        };

        const systemPrompt = systemPrompts[context] || systemPrompts.general;
        const userPrompt = `Context: ${context}
${relevant_files.length > 0 ? `Relevant Files:\n${relevant_files.map(f => `- ${f}`).join('\n')}` : ''}

Error Log:
\`\`\`
${error_log}
\`\`\`

Provide a structured debugging response.`;

        const nimResponse = await fetch(`${NIM_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NIM_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1,
            max_tokens: 2000,
          }),
        });

        if (!nimResponse.ok) {
          throw new Error(`NIM API error: ${nimResponse.status}`);
        }

        const nimData = await nimResponse.json();
        const analysis = nimData.choices[0]?.message?.content || 'No analysis generated';

        // Log the SOS request
        await supabase.from('nim_logs').insert({
          room_id,
          triggered_by: actingUserId,
          trigger_type: 'sos',
          model_used: DEEPSEEK_MODEL,
          prompt_tokens: nimData.usage?.prompt_tokens,
          completion_tokens: nimData.usage?.completion_tokens,
          input_text: JSON.stringify({ context, error_log: error_log.slice(0, 5000), relevant_files }),
          output_text: analysis,
          success: true,
        });

        return {
          content: [{ type: 'text', text: analysis }],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof McpError) throw error;
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, error.message);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error');
  }
});

// Resources
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'trackmywork://room/{room_id}/context',
      name: 'Room Context',
      description: 'Current room state including members, tasks, rules',
      mimeType: 'application/json',
    },
    {
      uri: 'trackmywork://user/{user_id}/permissions/{room_id}',
      name: 'User Permissions',
      description: 'User permissions in a specific room',
      mimeType: 'application/json',
    },
    {
      uri: 'trackmywork://room/{room_id}/env',
      name: 'Room Environment Variables',
      description: 'Secure .env variables for the room',
      mimeType: 'text/plain',
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const url = new URL(request.params.uri);

  if (url.pathname.startsWith('/room/') && url.pathname.endsWith('/context')) {
    const roomId = url.pathname.split('/')[2];
    const { data: room } = await supabase
      .from('rooms')
      .select('*, room_rules(*), room_members(*, users(*))')
      .eq('id', roomId)
      .single();

    const courtroomRulings = await loadCourtroomRulings(roomId);
    const agentsMdConstraints = buildCourtroomRulingsSection(courtroomRulings);

    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: 'application/json',
          text: `${agentsMdConstraints}\n\n---\n\n${JSON.stringify(
            { room, courtroom_rulings: courtroomRulings, agents_md_constraints: agentsMdConstraints },
            null,
            2
          )}`,
        },
      ],
    };
  }

  if (url.pathname.startsWith('/room/') && url.pathname.endsWith('/env')) {
    const roomId = url.pathname.split('/')[2];

    const { data: masterIntegrations } = await supabase
      .from('master_integrations')
      .select('name, config')
      .eq('is_active', true);

    const { data: roomIntegrations } = await supabase
      .from('room_integrations')
      .select('integration_name, config')
      .eq('room_id', roomId)
      .eq('is_active', true);

    const envConfig: Record<string, string> = {};
    for (const int of masterIntegrations || []) Object.assign(envConfig, int.config);
    for (const int of roomIntegrations || []) Object.assign(envConfig, int.config);

    const envContent = Object.entries(envConfig).map(([k, v]) => `${k}=${v}`).join('\n');

    return { contents: [{ uri: request.params.uri, mimeType: 'text/plain', text: envContent }] };
  }

  if (url.pathname.startsWith('/user/')) {
    const parts = url.pathname.split('/');
    const userId = parts[2];
    const roomId = parts[4];

    const { data: member } = await supabase
      .from('room_members')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .single();

    const { data: user } = await supabase
      .from('users')
      .select('is_global_admin')
      .eq('id', userId)
      .single();

    return {
      contents: [{
        uri: request.params.uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          isGlobalAdmin: user?.is_global_admin,
          isTeamLeader: member?.flag_is_team_leader,
          permissions: {
            can_edit_repo: member?.flag_can_edit_repo,
            can_trigger_nim: member?.flag_can_trigger_nim,
            can_assign_tasks: member?.flag_can_assign_tasks,
            can_upload_assets: member?.flag_can_upload_assets,
            can_manage_bom: member?.flag_can_manage_bom,
            can_invite_members: member?.flag_can_invite_members,
            can_edit_rules: member?.flag_can_edit_rules,
          },
        }, null, 2),
      }],
    };
  }

  throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${request.params.uri}`);
});

// Start MCP server (stdio transport for IDE integration)
const transport = new StdioServerTransport();
await server.connect(transport);

console.error('[MCP] TrackMyWork MCP Server running on stdio');
console.error('[MCP] Tools available: trackmywork_heartbeat, trackmywork_pull_env, trackmywork_status, trackmywork_get_context, trackmywork_create_task, trackmywork_sos_debug');
console.error('[MCP] WebSocket server running on port', MCP_WS_PORT, 'for real-time IDE connections');