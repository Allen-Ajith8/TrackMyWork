'use client';

import Link from 'next/link';
import { Plus, FolderKanban, Users, Lock, ArrowRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarGroup } from '@/components/ui/avatar';
import { formatRelativeTime } from '@/lib/utils';
import { getRoleColor } from '@/lib/utils';
import type { Room } from '@/types/database';

interface RoomWithRole extends Room {
  user_role: string;
  is_team_leader: boolean;
}

interface RoomsListClientProps {
  user: {
    id: string;
    email: string;
    username?: string | null;
    display_name?: string | null;
    is_global_admin: boolean;
  };
  rooms: RoomWithRole[];
}

export function RoomsListClient({ user, rooms }: RoomsListClientProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Your Rooms</h1>
          <p className="text-muted-foreground">Manage your hackathon projects and teams</p>
        </div>
        <Link href="/dashboard/rooms/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Room
          </Button>
        </Link>
      </div>

      {rooms.length === 0 ? (
        {/* Empty State */}
        <Card className="text-center py-12">
          <CardContent className="pt-6">
            <FolderKanban className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">No rooms yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first hackathon room to start collaborating with your team.
              Set up roles, track tasks, manage hardware BOM, and more.
            </p>
            <Link href="/dashboard/rooms/new">
              <Button size="lg">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Room
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        {/* Rooms Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map(room => (
            <Link key={room.id} href={`/dashboard/rooms/${room.id}`} className="block">
              <Card className="card-hover h-full flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                        <FolderKanban className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{room.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{room.project_type} • {room.team_size} members</p>
                      </div>
                    </div>
                    <Badge variant="role" role={room.user_role}>{room.user_role}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Lock className="w-4 h-4" />
                      <span>Invite: {room.invite_code}</span>
                    </div>
                    {room.description && (
                      <p className="text-muted-foreground line-clamp-2">{room.description}</p>
                    )}
                    {room.github_repo && (
                      <a href={room.github_repo} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary-600 hover:underline text-sm">
                        <Zap className="w-3 h-3" />
                        GitHub Repo
                      </a>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>Created</span>
                      <span>{formatRelativeTime(room.created_at)}</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {room.is_team_leader ? 'Team Leader' : 'Member'}
                    </span>
                    <Button variant="ghost" size="sm" className="h-8 px-3">
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}