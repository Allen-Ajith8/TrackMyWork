'use client';

import * as React from 'react';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store';
import {
  Plus,
  Search,
  Filter,
  Users,
  MoreVertical,
  Shield,
  UserCheck,
  UserX,
  Mail,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Toast, ToastProvider, ToastViewport, ToastTitle, ToastDescription } from '@/components/ui/toast';
import { cn, formatRelativeTime, getRoleColor } from '@/lib/utils';
import type { RoomMember, User, RoleTitle, RoomPermission, Room } from '@/types/database';

const ROLE_OPTIONS: { value: RoleTitle; label: string; defaultPermissions: Partial<Record<RoomPermission, boolean>> }[] = [
  { value: 'Team Leader', label: 'Team Leader', defaultPermissions: { can_edit_repo: true, can_trigger_nim: true, can_assign_tasks: true, can_upload_assets: true, can_manage_bom: true, can_invite_members: true, can_edit_rules: true } },
  { value: 'Frontend', label: 'Frontend', defaultPermissions: { can_edit_repo: true, can_upload_assets: true } },
  { value: 'Backend', label: 'Backend', defaultPermissions: { can_edit_repo: true, can_trigger_nim: true, can_assign_tasks: true } },
  { value: 'AI/ML', label: 'AI/ML', defaultPermissions: { can_edit_repo: true, can_trigger_nim: true } },
  { value: 'Pitch/Media', label: 'Pitch/Media', defaultPermissions: { can_upload_assets: true, can_invite_members: true } },
  { value: 'Video Editor', label: 'Video Editor', defaultPermissions: { can_upload_assets: true } },
  { value: 'Hardware', label: 'Hardware', defaultPermissions: { can_edit_repo: true, can_manage_bom: true } },
  { value: 'Designer', label: 'Designer', defaultPermissions: { can_upload_assets: true } },
  { value: 'DevOps', label: 'DevOps', defaultPermissions: { can_edit_repo: true, can_trigger_nim: true, can_assign_tasks: true, can_manage_bom: true } },
  { value: 'Custom', label: 'Custom', defaultPermissions: {} },
];

const PERMISSION_KEYS: RoomPermission[] = [
  'can_edit_repo',
  'can_trigger_nim',
  'can_assign_tasks',
  'can_upload_assets',
  'can_manage_bom',
  'can_invite_members',
  'can_edit_rules',
];

const PERMISSION_LABELS: Record<RoomPermission, string> = {
  can_edit_repo: 'Edit Repository',
  can_trigger_nim: 'Trigger NIM AI',
  can_assign_tasks: 'Assign Tasks',
  can_upload_assets: 'Upload Assets',
  can_manage_bom: 'Manage BOM',
  can_invite_members: 'Invite Members',
  can_edit_rules: 'Edit Room Rules',
};

const PERMISSION_DESCRIPTIONS: Record<RoomPermission, string> = {
  can_edit_repo: 'Push code, create branches, merge PRs',
  can_trigger_nim: 'Run AI summaries, code reviews, SOS debugging',
  can_assign_tasks: 'Create and assign tasks to team members',
  can_upload_assets: 'Upload APKs, Lottie files, presentations',
  can_manage_bom: 'Add/edit hardware components and costs',
  can_invite_members: 'Invite new members to the room',
  can_edit_rules: 'Modify tech stack locks and room rules',
};

interface MemberRowProps {
  member: RoomMember & { user: User };
  currentUserId: string;
  isTeamLeader: boolean;
  isGlobalAdmin: boolean;
  onUpdate: (memberId: string, updates: Partial<RoomMember>) => void;
  onRemove: (memberId: string) => void;
  onResendInvite: (memberId: string) => void;
}

function MemberRow({ member, currentUserId, isTeamLeader, isGlobalAdmin, onUpdate, onRemove, onResendInvite }: MemberRowProps) {
  const [expanded, setExpanded] = React.useState(false);
  const isSelf = member.user_id === currentUserId;
  const isPending = member.status === 'pending';
  const canManage = isGlobalAdmin || isTeamLeader || (isSelf && !isPending);

  const handlePermissionChange = (key: RoomPermission, value: boolean) => {
    if (!canManage) return;
    onUpdate(member.id, { [key]: value });
  };

  const handleRoleChange = (role: RoleTitle) => {
    if (!canManage) return;
    const roleConfig = ROLE_OPTIONS.find(r => r.value === role);
    const updates: Partial<RoomMember> = { role_title: role };
    if (roleConfig) {
      Object.assign(updates, roleConfig.defaultPermissions);
    }
    if (role === 'Custom') {
      updates.custom_role_name = member.custom_role_name;
    } else {
      updates.custom_role_name = undefined;
    }
    onUpdate(member.id, updates);
  };

  if (isPending) {
    return (
      <div className="border rounded-lg p-4 bg-yellow-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Mail className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">{member.custom_role_name || member.role_title}</p>
              <p className="text-sm text-muted-foreground">Invited: {formatRelativeTime(member.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Pending</Badge>
            {canManage && (
              <>
                <Button variant="outline" size="sm" onClick={() => onResendInvite(member.id)}>
                  Resend
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onRemove(member.id)} className="text-red-600">
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="p-4 flex items-center gap-4" onClick={() => setExpanded(!expanded)}>
        <Avatar className="h-10 w-10" src={member.user.avatar_url} fallback={member.user.display_name || member.user.username || member.user.email} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{member.user.display_name || member.user.username || member.user.email}</p>
            <Badge variant="role" role={member.role_title}>{member.role_title}</Badge>
            {member.flag_is_team_leader && <Shield className="w-4 h-4 text-purple-600" />}
            {isSelf && <span className="badge bg-secondary">You</span>}
          </div>
          <p className="text-sm text-muted-foreground truncate">{member.user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {isPending && <Badge variant="secondary">Pending</Badge>}
          {member.flag_is_team_leader && <Badge variant="default">Team Leader</Badge>}
          <svg className={cn('w-4 h-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>

      {expanded && canManage && (
        <div className="px-4 pb-4 border-t bg-muted/30 animate-in slide-in-from-top-2 duration-200">
          <Separator className="my-3" />
          
          {/* Role Selector */}
          <div className="space-y-2 mb-4">
            <Label>Role</Label>
            <Select onValueChange={handleRoleChange} defaultValue={member.role_title}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map(role => (
                  <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {member.role_title === 'Custom' && member.custom_role_name && (
              <p className="text-sm text-muted-foreground">Custom: {member.custom_role_name}</p>
            )}
          </div>

          {/* Permissions Grid */}
          <div className="space-y-2">
            <Label>Permissions</Label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PERMISSION_KEYS.map(perm => (
                <label key={perm} className="flex items-center gap-2 cursor-pointer group">
                  <Switch
                    checked={Boolean((member as any)[`flag_${perm}`])}
                    onCheckedChange={(checked) => handlePermissionChange(perm, checked)}
                    disabled={!canManage || (member.flag_is_team_leader && perm !== 'can_edit_rules')}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{PERMISSION_LABELS[perm]}</p>
                    <p className="text-xs text-muted-foreground">{PERMISSION_DESCRIPTIONS[perm]}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t">
            {!isSelf && !member.flag_is_team_leader && (
              <Button variant="outline" size="sm" onClick={() => onUpdate(member.id, { flag_is_team_leader: true })}>
                <Shield className="w-4 h-4 mr-2" />
                Make Team Leader
              </Button>
            )}
            {!isSelf && (
              <Button variant="ghost" size="sm" onClick={() => onRemove(member.id)} className="text-red-600 hover:text-red-700">
                <UserX className="w-4 h-4 mr-2" />
                Remove
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { email: string; role_title: RoleTitle; custom_role_name?: string; permissions: Partial<Record<RoomPermission, boolean>> }) => void;
}

function InviteDialog({ open, onOpenChange, onSubmit }: InviteDialogProps) {
  const [formData, setFormData] = React.useState({
    email: '',
    role_title: 'Custom' as RoleTitle,
    custom_role_name: '',
    permissions: {} as Partial<Record<RoomPermission, boolean>>,
  });

  const roleConfig = ROLE_OPTIONS.find(r => r.value === formData.role_title);

  React.useEffect(() => {
    if (roleConfig) {
      setFormData(prev => ({
        ...prev,
        permissions: roleConfig.defaultPermissions,
        custom_role_name: formData.role_title === 'Custom' ? prev.custom_role_name : '',
      }));
    }
  }, [formData.role_title, roleConfig]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) return;
    onSubmit({ ...formData });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="teammate@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select onValueChange={(v: string) => setFormData({ ...formData, role_title: v as RoleTitle })} defaultValue={formData.role_title}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map(role => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {formData.role_title === 'Custom' && (
            <div className="space-y-2">
              <Label htmlFor="custom_role_name">Custom Role Name</Label>
              <Input
                id="custom_role_name"
                placeholder="e.g., Blockchain Lead"
                value={formData.custom_role_name}
                onChange={(e) => setFormData({ ...formData, custom_role_name: e.target.value })}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Permissions</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {PERMISSION_KEYS.map(perm => (
                <label key={perm} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.permissions[perm] || false}
                    onChange={(e) => setFormData(prev => ({ ...prev, permissions: { ...prev.permissions, [perm]: e.target.checked } }))}
                    className="rounded border-input"
                  />
                  <span className="text-sm">{PERMISSION_LABELS[perm]}</span>
                </label>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!formData.email}>Send Invite</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RoomTeamClient({ room, initialMembers }: {
  room: Room;
  initialMembers: (RoomMember & { user: User })[];
}) {
  const { user } = useAuthStore();
  const [members, setMembers] = React.useState(initialMembers);
  const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState<'all' | 'active' | 'pending'>('all');
  const [filterRole, setFilterRole] = React.useState<string>('all');
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; title: string; message: string } | null>(null);

  const isTeamLeader = initialMembers.find(m => m.user_id === user?.id)?.flag_is_team_leader || false;
  const isGlobalAdmin = user?.is_global_admin || false;
  const canManage = isTeamLeader || isGlobalAdmin;

  const filteredMembers = members.filter(m => {
    if (searchQuery && !m.user.email.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !(m.user.display_name?.toLowerCase().includes(searchQuery.toLowerCase())) &&
        !(m.user.username?.toLowerCase().includes(searchQuery.toLowerCase()))) {
      return false;
    }
    if (filterStatus !== 'all' && m.status !== filterStatus) return false;
    if (filterRole !== 'all' && m.role_title !== filterRole) return false;
    return true;
  });

  const handleUpdateMember = async (memberId: string, updates: Partial<RoomMember>) => {
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, ...updates } : m));
    try {
      const supabase = createClient();
      const { error } = await supabase.from('room_members').update(updates).eq('id', memberId);
      if (error) throw error;
    } catch (error) {
      console.error('Failed to update member:', error);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    setMembers(prev => prev.filter(m => m.id !== memberId));
    try {
      const supabase = createClient();
      const { error } = await supabase.from('room_members').delete().eq('id', memberId);
      if (error) throw error;
      setToast({ type: 'success', title: 'Removed', message: 'Member has been removed from the room' });
    } catch (error) {
      console.error('Failed to remove member:', error);
      setToast({ type: 'error', title: 'Error', message: 'Failed to remove member' });
    }
  };

  const handleResendInvite = async (memberId: string) => {
    setToast({ type: 'success', title: 'Invite Resent', message: 'Invitation email has been sent again' });
  };

  const handleInviteSubmit = async (data: { email: string; role_title: RoleTitle; custom_role_name?: string; permissions: Partial<Record<RoomPermission, boolean>> }) => {
    setToast({ type: 'success', title: 'Invite Sent', message: `Invitation sent to ${data.email}` });
    const newMember: RoomMember & { user: User } = {
      id: crypto.randomUUID(),
      room_id: room.id,
      user_id: data.email,
      status: 'pending',
      role_title: data.role_title,
      custom_role_name: data.custom_role_name ?? null,
      flag_can_edit_repo: data.permissions.can_edit_repo || false,
      flag_can_trigger_nim: data.permissions.can_trigger_nim || false,
      flag_can_assign_tasks: data.permissions.can_assign_tasks || false,
      flag_can_upload_assets: data.permissions.can_upload_assets || false,
      flag_can_manage_bom: data.permissions.can_manage_bom || false,
      flag_can_invite_members: data.permissions.can_invite_members || false,
      flag_can_edit_rules: data.permissions.can_edit_rules || false,
      flag_is_team_leader: false,
      joined_at: null,
      invited_by: user?.id ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user: {
        id: data.email,
        email: data.email,
        username: data.email.split('@')[0],
        display_name: data.custom_role_name || data.role_title,
        avatar_url: null,
        is_global_admin: false,
        fcm_token: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };
    setMembers(prev => [...prev, newMember]);
  };

  const uniqueRoles = Array.from(new Set(members.map(m => m.role_title)));

  return (
    <ToastProvider>
      <div className="h-[calc(100vh-64px)] flex flex-col">
        {/* Header */}
        <div className="border-b bg-white px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Team</h1>
                <p className="text-sm text-muted-foreground">Members of {room.name}</p>
              </div>
            </div>
            {canManage && (
              <Button asChild>
                <DialogTrigger asChild>
                  <button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Invite Member
                  </button>
                </DialogTrigger>
              </Button>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="border-b bg-white px-6 py-3 flex-shrink-0">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select onValueChange={setFilterStatus} defaultValue={filterStatus} className="w-36">
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select onValueChange={setFilterRole} defaultValue={filterRole} className="w-40">
              <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {uniqueRoles.map(role => <SelectItem key={role} value={role}>{role}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 ml-auto">
              {canManage && (
                <Button variant="outline" size="sm" asChild>
                  <DialogTrigger asChild>
                    <button className="gap-2">
                      <Plus className="w-4 h-4" />
                      Invite
                    </button>
                  </DialogTrigger>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Members List */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Users className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg">No members found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="space-y-3 max-w-4xl">
              {filteredMembers.map(member => (
                <MemberRow
                  key={member.id}
                  member={member}
                  currentUserId={user?.id || ''}
                  isTeamLeader={isTeamLeader}
                  isGlobalAdmin={isGlobalAdmin}
                  onUpdate={handleUpdateMember}
                  onRemove={handleRemoveMember}
                  onResendInvite={handleResendInvite}
                />
              ))}
            </div>
          )}
        </div>

        {/* Dialogs */}
        <InviteDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          onSubmit={handleInviteSubmit}
        />

        <ToastViewport />
      </div>

      {toast && (
        <Toast>
          <ToastTitle>{toast.title}</ToastTitle>
          <ToastDescription>{toast.message}</ToastDescription>
        </Toast>
      )}
    </ToastProvider>
  );
}