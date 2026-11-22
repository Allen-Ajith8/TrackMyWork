'use client';

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Megaphone, 
  Users, 
  Pin, 
  Sparkles, 
  Clock, 
  Github, 
  Key, 
  Check, 
  Copy,
  MessageSquare,
  ShieldAlert,
  BookOpen,
  Bot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRelativeTime } from '@/lib/utils';
import type { User } from '@/types/database';

export interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  user_role: string;
  content: string;
  is_announcement: boolean;
  created_at: string;
  ai_meta?: {
    referencedArtifacts?: {
      id: string;
      title: string;
      type: string;
      kind: string;
      isRulebook: boolean;
      hasText: boolean;
    }[];
    usedFallback?: boolean;
    hasRulebook?: boolean;
  };
}

interface RoomTeamChatProps {
  roomId: string;
  roomName: string;
  inviteCode: string;
  githubRepo: string | null;
  deadline: string | null;
  currentUser: User | null;
  isTeamLeader: boolean;
  userRole: string;
}

export function RoomTeamChat({
  roomId,
  roomName,
  inviteCode,
  githubRepo,
  deadline,
  currentUser,
  isTeamLeader,
  userRole,
}: RoomTeamChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const storageKey = `trackmywork-chat-${roomId}`;

  // Default initial welcome messages
  const defaultMessages: ChatMessage[] = [
    {
      id: 'system-welcome',
      room_id: roomId,
      user_id: 'system',
      user_name: 'CodeTrack Bot',
      user_avatar: null,
      user_role: 'AI/ML',
      content: `🎉 Welcome to **${roomName}**! This is your team's live communication channel. Coordinate tasks, share commits, and plan your sprint together.`,
      is_announcement: false,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'system-code',
      room_id: roomId,
      user_id: 'system',
      user_name: 'Team Coordinator',
      user_avatar: null,
      user_role: 'Team Leader',
      content: `🔑 Teammate Invite Code: **${inviteCode}**. Direct join link is ready in the Invite Teammate menu.`,
      is_announcement: true,
      created_at: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: 'system-mica',
      room_id: roomId,
      user_id: 'mica-agent',
      user_name: 'MICA',
      user_avatar: null,
      user_role: 'AI Assistant',
      content:
        'Hi, I am **MICA**. Ask me `/mica what are our project rules and constraints?` and I will answer using the room Artifacts, `rules.md`, research notes and saved AI task summaries.',
      is_announcement: false,
      created_at: new Date(Date.now() - 900000).toISOString(),
    },
  ];

  // Load messages on mount
  useEffect(() => {
    let localSaved: ChatMessage[] = [];
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        localSaved = JSON.parse(stored);
      }
    } catch {}

    if (localSaved.length > 0) {
      setMessages(localSaved);
    } else {
      setMessages(defaultMessages);
    }

    // Fetch from API
    fetch(`/api/rooms/${roomId}/chat`)
      .then((res) => res.json())
      .then((data) => {
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
          try {
            localStorage.setItem(storageKey, JSON.stringify(data.messages));
          } catch {}
        }
      })
      .catch(() => {});
  }, [roomId, storageKey]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const persistMessages = (list: ChatMessage[]) => {
    setMessages(list);
    try {
      localStorage.setItem(storageKey, JSON.stringify(list));
    } catch {}
  };

  const askMica = async (question: string, baseMessages: ChatMessage[]) => {
    setLoading(true);

    try {
      const history = baseMessages
        .filter((message) => message.user_id !== 'mica-agent' && !message.id.startsWith('system-'))
        .slice(-10)
        .map((message) => ({
          role: message.user_id === currentUser?.id ? ('user' as const) : ('assistant' as const),
          content: `${message.user_name}: ${message.content}`,
        }));

      const response = await fetch(`/api/rooms/${roomId}/mica`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          history,
          user_name: currentUser?.display_name || currentUser?.username || 'Teammate',
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'MICA could not answer right now.');
      }

      const micaMessage: ChatMessage = {
        id: `mica-${Date.now()}`,
        room_id: roomId,
        user_id: 'mica-agent',
        user_name: 'MICA',
        user_avatar: null,
        user_role: 'AI Assistant',
        content: data.reply || data.message || 'No answer generated.',
        is_announcement: false,
        created_at: new Date().toISOString(),
        ai_meta: {
          referencedArtifacts: Array.isArray(data.referencedArtifacts) ? data.referencedArtifacts : [],
          usedFallback: Boolean(data.usedFallback),
          hasRulebook: Boolean(data.hasRulebook),
        },
      };

      persistMessages([...baseMessages, micaMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `mica-error-${Date.now()}`,
        room_id: roomId,
        user_id: 'mica-agent',
        user_name: 'MICA',
        user_avatar: null,
        user_role: 'AI Assistant',
        content:
          error instanceof Error
            ? `I could not answer: ${error.message}`
            : 'I could not answer right now. Please try again.',
        is_announcement: false,
        created_at: new Date().toISOString(),
      };
      persistMessages([...baseMessages, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (textToSend?: string, announceOverride?: boolean) => {
    const text = (textToSend ?? input).trim();
    if (!text) return;

    const announce = announceOverride !== undefined ? announceOverride : isAnnouncement;

    const optimisticMsg: ChatMessage = {
      id: `client-${Date.now()}`,
      room_id: roomId,
      user_id: currentUser?.id || 'demo-dev-user-001',
      user_name: currentUser?.display_name || currentUser?.username || currentUser?.email?.split('@')[0] || (isTeamLeader ? 'Team Leader' : 'Teammate'),
      user_avatar: currentUser?.avatar_url || null,
      user_role: userRole || (isTeamLeader ? 'Team Leader' : 'Frontend'),
      content: text,
      is_announcement: announce,
      created_at: new Date().toISOString(),
    };

    const updated = [...messages, optimisticMsg];
    persistMessages(updated);
    if (!textToSend) setInput('');
    setIsAnnouncement(false);

    // `/mica <question>` is answered by MICA with room-artifact grounding.
    const micaMatch = text.match(/^\/(mica|askmica)\b([\s\S]*)$/i);
    if (micaMatch) {
      const question =
        micaMatch[2].trim() ||
        'Summarize our project rules, constraints, research artifacts and current status.';
      await askMica(question, updated);
      return;
    }

    // Post to server
    try {
      setLoading(true);
      await fetch(`/api/rooms/${roomId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          is_announcement: announce,
          user_name: optimisticMsg.user_name,
          user_role: optimisticMsg.user_role,
        }),
      });
    } catch (err) {
      console.warn('Failed to post message to server:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Quick Action Broadcasts for Team Leader
  const broadcastDeadline = () => {
    if (!deadline) {
      handleSendMessage('⏰ Team Reminder: Please remember to keep track of our upcoming hackathon milestone deadlines!', true);
      return;
    }
    const dateFormatted = new Date(deadline).toLocaleString();
    handleSendMessage(`🚨 **OFFICIAL DEADLINE ANNOUNCEMENT**:\nOur project submission deadline is **${dateFormatted}**. Please ensure all features are finalized, tested, and code is committed to GitHub!`, true);
  };

  const broadcastGithub = () => {
    if (!githubRepo) {
      handleSendMessage('🔗 Please connect our GitHub repository using the "Connect GitHub" button in the room header!', false);
      return;
    }
    handleSendMessage(`📦 **GitHub Repository**: We are building at ${githubRepo}. Ensure your feature branches are up to date!`, false);
  };

  const broadcastInviteCode = () => {
    handleSendMessage(`🔑 **Room Invite Code**: \`${inviteCode}\`\nShare this code or click "Invite Teammate" in the header to send email invites!`, false);
  };

  const latestAnnouncement = [...messages].reverse().find((m) => m.is_announcement);

  return (
    <Card className="flex flex-col h-[calc(100vh-210px)] border shadow-sm">
      <CardHeader className="py-3 px-4 border-b flex-shrink-0 bg-surface-50/50">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <span>Team Live Chat</span>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">
                Real-time communication for {roomName}
              </p>
            </div>
          </div>

          {/* Quick Action Buttons for Team Leader */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setInput('/mica ')}
              className="h-7 text-xs font-semibold gap-1 px-2.5 border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100"
              title="Ask MICA using the room's artifacts and rulebooks"
            >
              <Sparkles className="w-3 h-3 text-purple-600" />
              <span>Ask MICA</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={broadcastInviteCode}
              className="h-7 text-xs font-semibold gap-1 px-2.5"
              title="Share 6-digit room code in chat"
            >
              <Key className="w-3 h-3 text-primary-600" />
              <span>Share Code</span>
            </Button>
            {githubRepo && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={broadcastGithub}
                className="h-7 text-xs font-semibold gap-1 px-2.5"
                title="Share GitHub link in chat"
              >
                <Github className="w-3 h-3 text-surface-700" />
                <span>Share Repo</span>
              </Button>
            )}
            {deadline && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={broadcastDeadline}
                className="h-7 text-xs font-semibold gap-1 px-2.5 border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100"
                title="Broadcast submission deadline notice to the team"
              >
                <Clock className="w-3 h-3 text-amber-600" />
                <span>Broadcast Deadline</span>
              </Button>
            )}
          </div>
        </div>

        {/* Pinned Latest Announcement Banner */}
        {latestAnnouncement && (
          <div className="mt-2.5 p-2.5 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 text-purple-950 flex items-start gap-2 shadow-xs">
            <Megaphone className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5 flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] uppercase tracking-wider text-purple-900 flex items-center gap-1">
                  <Pin className="w-3 h-3 text-purple-600" /> Pinned Leader Announcement
                </span>
                <span className="text-[10px] text-purple-600">
                  {formatRelativeTime(latestAnnouncement.created_at)}
                </span>
              </div>
              <p className="text-xs text-purple-900 font-medium whitespace-pre-wrap line-clamp-2">
                {latestAnnouncement.content}
              </p>
            </div>
          </div>
        )}
      </CardHeader>

      {/* Messages Thread */}
      <CardContent className="flex-1 p-4 overflow-y-auto space-y-3" ref={scrollRef}>
        {messages.map((msg) => {
          const isMica = msg.user_id === 'mica-agent' || msg.user_role === 'AI Assistant';
          const isSelf =
            !isMica &&
            currentUser &&
            (msg.user_id === currentUser.id || msg.user_name === currentUser.display_name);

          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${isSelf ? 'justify-end' : 'justify-start'}`}
            >
              {!isSelf && (
                <Avatar
                  className={`w-7 h-7 text-xs shrink-0 mt-0.5 border ${
                    isMica ? 'bg-purple-100 text-purple-800 border-purple-300' : ''
                  }`}
                  src={msg.user_avatar || undefined}
                  fallback={isMica ? 'AI' : msg.user_name.slice(0, 2).toUpperCase()}
                />
              )}

              <div className={`max-w-[80%] space-y-1 ${isSelf ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-center gap-1.5 text-[11px] ${isSelf ? 'justify-end' : 'justify-start'}`}>
                  <span className="font-bold text-foreground">{msg.user_name}</span>
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1.5 py-0 h-4 font-semibold ${
                      isMica
                        ? 'bg-purple-100 text-purple-800 border-purple-300'
                        : msg.user_role === 'Team Leader'
                        ? 'bg-purple-50 text-purple-800 border-purple-300'
                        : msg.user_role === 'AI/ML'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-blue-50 text-blue-800 border-blue-300'
                    }`}
                  >
                    {isMica && <Bot className="w-2.5 h-2.5 mr-0.5" />}
                    {msg.user_role}
                  </Badge>
                  <span className="text-muted-foreground text-[10px]">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div
                  className={`p-3 rounded-2xl text-xs leading-relaxed ${
                    msg.is_announcement
                      ? 'bg-purple-100/90 text-purple-950 border border-purple-300 font-medium shadow-xs'
                      : isMica
                      ? 'bg-gradient-to-br from-purple-50 to-indigo-50 text-surface-900 border border-purple-200 rounded-tl-xs shadow-xs'
                      : isSelf
                      ? 'bg-primary-600 text-white rounded-tr-xs'
                      : 'bg-surface-100 text-foreground border border-surface-200 rounded-tl-xs'
                  }`}
                >
                  {msg.is_announcement && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-purple-800 uppercase tracking-wider mb-1">
                      <Megaphone className="w-3 h-3 text-purple-600" />
                      Leader Announcement
                    </div>
                  )}
                  {isMica && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-purple-800 uppercase tracking-wider mb-1">
                      <Sparkles className="w-3 h-3 text-purple-600" />
                      MICA · artifact-grounded answer
                    </div>
                  )}
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>

                  {isMica && msg.ai_meta?.referencedArtifacts && msg.ai_meta.referencedArtifacts.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-purple-200/80 space-y-1">
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-purple-900">
                        <BookOpen className="w-3 h-3" />
                        Referenced {msg.ai_meta.referencedArtifacts.length} artifact
                        {msg.ai_meta.referencedArtifacts.length === 1 ? '' : 's'}
                        {msg.ai_meta.usedFallback ? ' · offline grounded' : ''}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {msg.ai_meta.referencedArtifacts.map((artifact) => (
                          <span
                            key={artifact.id}
                            className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${
                              artifact.isRulebook
                                ? 'border-purple-300 bg-purple-100 text-purple-900'
                                : 'border-surface-200 bg-white text-surface-700'
                            }`}
                            title={`${artifact.type}${artifact.kind ? ` · ${artifact.kind}` : ''}`}
                          >
                            {artifact.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {isSelf && (
                <Avatar
                  className="w-7 h-7 text-xs shrink-0 mt-0.5 border"
                  src={currentUser?.avatar_url || undefined}
                  fallback={(currentUser?.display_name || 'ME').slice(0, 2).toUpperCase()}
                />
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-[11px] text-purple-800 bg-purple-50 border border-purple-200 rounded-xl px-3 py-2 w-fit">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            MICA is reading the room artifacts…
          </div>
        )}
      </CardContent>

      {/* Message Composer Footer */}
      <div className="p-3 border-t bg-surface-50/60 flex-shrink-0 space-y-2">
        {isTeamLeader && (
          <div className="flex items-center justify-between text-xs px-1">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-purple-900">
              <Switch
                checked={isAnnouncement}
                onCheckedChange={setIsAnnouncement}
                className="scale-75 data-[state=checked]:bg-purple-600"
              />
              <span className="flex items-center gap-1">
                <Megaphone className="w-3.5 h-3.5 text-purple-600" />
                Post as Pinned Leader Announcement
              </span>
            </label>
            <span className="text-[10px] text-muted-foreground">Visible to all teammates</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isAnnouncement
                ? 'Type an announcement for your team...'
                : 'Message your team, or ask /mica about rules.md and artifacts...'
            }
            className="flex-1 text-xs h-10 bg-white"
          />
          <Button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || loading}
            className={`h-10 px-4 text-xs font-semibold gap-1.5 ${
              isAnnouncement ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-primary-600 hover:bg-primary-700 text-white'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}
