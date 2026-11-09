'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, Check, Loader2, SkipForward, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toast, ToastProvider, ToastViewport, ToastTitle, ToastDescription } from '@/components/ui/toast';
import { createClient } from '@/lib/supabase/client';
import { generateInviteCode, cn } from '@/lib/utils';
import type { ProjectType, RoleTitle, RoomPermission } from '@/types/database';

// Step 1: Basics
const step1Schema = z.object({
  name: z.string().min(2, 'Room name must be at least 2 characters'),
  description: z.string().optional(),
  hackathon_sheet_row_id: z.string().optional(),
  github_repo: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  team_size: z.coerce.number().min(2).max(10),
  project_type: z.enum(['software', 'hardware', 'hybrid']),
});

type Step1Data = z.infer<typeof step1Schema>;

// Step 2: Team/RBAC
const memberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role_title: z.enum(['Team Leader', 'Frontend', 'Backend', 'AI/ML', 'Pitch/Media', 'Video Editor', 'Hardware', 'Designer', 'DevOps', 'Custom']),
  custom_role_name: z.string().optional(),
  can_edit_repo: z.boolean().default(false),
  can_trigger_nim: z.boolean().default(false),
  can_assign_tasks: z.boolean().default(false),
  can_upload_assets: z.boolean().default(false),
  can_manage_bom: z.boolean().default(false),
  can_invite_members: z.boolean().default(false),
  can_edit_rules: z.boolean().default(false),
});

const step2Schema = z.object({
  members: z.array(memberSchema).optional(),
});

type Step2Data = z.infer<typeof step2Schema>;

// Step 3: Rules
const step3Schema = z.object({
  tech_stack_locks: z.array(z.string()).optional(),
  budget_cap: z.preprocess(
    (value) =>
      value === '' ||
      value === null ||
      value === undefined ||
      (typeof value === 'number' && Number.isNaN(value))
        ? undefined
        : value,
    z.coerce.number().optional()
  ),
  custom_agent_instructions: z.string().optional(),
  nim_auto_broadcast: z.boolean().default(false),
  auto_task_progression: z.boolean().default(true),
  non_tech_translation: z.boolean().default(true),
});

type Step3Data = z.infer<typeof step3Schema>;

const fullSchema = step1Schema.merge(step2Schema).merge(step3Schema);
type FullFormData = z.infer<typeof fullSchema>;

const ROLE_OPTIONS: { value: RoleTitle; label: string; defaultPermissions: Partial<Record<RoomPermission, boolean>> }[] = [
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

export function RoomCreationWizard() {
  const router = useRouter();
  const [step, setStep] = React.useState(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; title: string; message: string } | null>(null);
  const supabase = createClient();

  const form = useForm<FullFormData>({
    resolver: zodResolver(fullSchema) as any,
    defaultValues: {
      name: '',
      description: '',
      hackathon_sheet_row_id: '',
      github_repo: '',
      team_size: 4,
      project_type: 'software',
      members: [],
      tech_stack_locks: [],
      budget_cap: undefined,
      custom_agent_instructions: '',
      nim_auto_broadcast: false,
      auto_task_progression: true,
      non_tech_translation: true,
    },
  });

  const watchTeamSize = form.watch('team_size');
  const watchMembers = form.watch('members') || [];
  const watchProjectType = form.watch('project_type');

  const handleSkip = async () => {
    setIsSubmitting(true);
    try {
      const data = form.getValues();
      const inviteCode = generateInviteCode();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: room, error } = await supabase
        .from('rooms')
        .insert({
          name: data.name || 'Untitled Room',
          description: data.description,
          invite_code: inviteCode,
          hackathon_sheet_row_id: data.hackathon_sheet_row_id || null,
          github_repo: data.github_repo || null,
          team_size: data.team_size,
          project_type: data.project_type,
          is_setup_complete: false,
          jury_expectations: '',
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Create default room rules
      await supabase.from('room_rules').insert({ room_id: room.id });

      // Add creator as Team Leader
      await supabase.from('room_members').insert({
        room_id: room.id,
        user_id: user.id,
        status: 'active',
        role_title: 'Team Leader',
        flag_is_team_leader: true,
        flag_can_edit_repo: true,
        flag_can_trigger_nim: true,
        flag_can_assign_tasks: true,
        flag_can_upload_assets: true,
        flag_can_manage_bom: true,
        flag_can_invite_members: true,
        flag_can_edit_rules: true,
        joined_at: new Date().toISOString(),
      });

      setToast({ type: 'success', title: 'Room Created!', message: `Invite code: ${inviteCode}` });
      setTimeout(() => router.push(`/dashboard/rooms/${room.id}`), 1500);
    } catch (error) {
      setToast({ type: 'error', title: 'Error', message: error instanceof Error ? error.message : 'Failed to create room' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = async () => {
    const isValid = await form.trigger();
    if (isValid && step < 3) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async (data: FullFormData) => {
    setIsSubmitting(true);
    try {
      const inviteCode = generateInviteCode();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: room, error } = await supabase
        .from('rooms')
        .insert({
          name: data.name,
          description: data.description,
          invite_code: inviteCode,
          hackathon_sheet_row_id: data.hackathon_sheet_row_id || null,
          github_repo: data.github_repo || null,
          team_size: data.team_size,
          project_type: data.project_type,
          is_setup_complete: true,
          jury_expectations: data.custom_agent_instructions || '',
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Create room rules
      await supabase.from('room_rules').insert({
        room_id: room.id,
        tech_stack_locks: data.tech_stack_locks || [],
        budget_cap: data.budget_cap,
        custom_agent_instructions: data.custom_agent_instructions,
        nim_auto_broadcast: data.nim_auto_broadcast,
        auto_task_progression: data.auto_task_progression,
        non_tech_translation: data.non_tech_translation,
      });

      // Add creator as Team Leader
      await supabase.from('room_members').insert({
        room_id: room.id,
        user_id: user.id,
        status: 'active',
        role_title: 'Team Leader',
        flag_is_team_leader: true,
        flag_can_edit_repo: true,
        flag_can_trigger_nim: true,
        flag_can_assign_tasks: true,
        flag_can_upload_assets: true,
        flag_can_manage_bom: true,
        flag_can_invite_members: true,
        flag_can_edit_rules: true,
        joined_at: new Date().toISOString(),
      });

      // Add invited members
      if (data.members && data.members.length > 0) {
        const memberInserts = data.members.map((m) => ({
          room_id: room.id,
          user_id: m.email, // Will be resolved via invite flow
          email: m.email, // We'll need to handle this differently
          status: 'pending' as const,
          role_title: m.role_title,
          custom_role_name: m.custom_role_name,
          flag_can_edit_repo: m.can_edit_repo,
          flag_can_trigger_nim: m.can_trigger_nim,
          flag_can_assign_tasks: m.can_assign_tasks,
          flag_can_upload_assets: m.can_upload_assets,
          flag_can_manage_bom: m.can_manage_bom,
          flag_can_invite_members: m.can_invite_members,
          flag_can_edit_rules: m.can_edit_rules,
          flag_is_team_leader: false,
          invited_by: user.id,
        }));

        // For now, we'll skip actual member insertion and just log
        console.log('Members to invite:', memberInserts);
      }

      setToast({ type: 'success', title: 'Room Created!', message: `Invite code: ${inviteCode}` });
      setTimeout(() => router.push(`/dashboard/rooms/${room.id}`), 1500);
    } catch (error) {
      setToast({ type: 'error', title: 'Error', message: error instanceof Error ? error.message : 'Failed to create room' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addMember = () => {
    const current = form.getValues('members') || [];
    form.setValue('members', [...current, { email: '', role_title: 'Custom', can_edit_repo: false, can_trigger_nim: false, can_assign_tasks: false, can_upload_assets: false, can_manage_bom: false, can_invite_members: false, can_edit_rules: false }]);
  };

  const removeMember = (index: number) => {
    const current = form.getValues('members') || [];
    form.setValue('members', current.filter((_, i) => i !== index));
  };

  const updateMemberPermission = (index: number, key: RoomPermission, value: boolean) => {
    const current = form.getValues('members') || [];
    const updated = [...current];
    updated[index] = { ...updated[index], [key]: value };
    form.setValue('members', updated);
  };

  const updateMemberRole = (index: number, role: RoleTitle) => {
    const current = form.getValues('members') || [];
    const roleConfig = ROLE_OPTIONS.find(r => r.value === role);
    const updated = [...current];
    updated[index] = {
      ...updated[index],
      role_title: role,
      custom_role_name: role === 'Custom' ? updated[index].custom_role_name : undefined,
      ...roleConfig?.defaultPermissions,
    };
    form.setValue('members', updated);
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
          <CardDescription>Essential information about your hackathon room</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Room Name *</Label>
            <Input
              id="name"
              placeholder="My Awesome Hackathon Project"
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-sm font-medium text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Brief description of your project..."
              {...form.register('description')}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="github_repo">GitHub Repository (Optional)</Label>
            <Input
              id="github_repo"
              placeholder="https://github.com/owner/repo"
              {...form.register('github_repo')}
            />
            <p className="text-xs text-muted-foreground">
              After creating the room, open Settings → Repository to authorize
              this repo with GitHub. That installs webhooks automatically so
              commits and PRs sync to your room.
            </p>
            {form.formState.errors.github_repo && (
              <p className="text-sm font-medium text-destructive">
                {form.formState.errors.github_repo.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="hackathon_sheet_row_id">Hackathon Tracker Row ID (Optional)</Label>
            <Input
              id="hackathon_sheet_row_id"
              placeholder="Row ID from master Google Sheet"
              {...form.register('hackathon_sheet_row_id')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="team_size">Team Size</Label>
              <Select onValueChange={(v: string) => form.setValue('team_size', Number(v))} defaultValue={watchTeamSize.toString()}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                    <SelectItem key={n} value={n.toString()}>{n} members</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project_type">Project Type</Label>
              <Select onValueChange={(v: string) => form.setValue('project_type', v as ProjectType)} defaultValue={watchProjectType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="software">Software</SelectItem>
                  <SelectItem value="hardware">Hardware</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team & RBAC</CardTitle>
              <CardDescription>Invite team members and configure their roles and permissions</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={addMember}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Member
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {watchMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p>No team members added yet. Click "Add Member" to invite teammates.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {watchMembers.map((member, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor={`member-email-${index}`}>Email *</Label>
                        <Input
                          id={`member-email-${index}`}
                          placeholder="teammate@example.com"
                          onChange={(e) => {
                            const current = form.getValues('members') || [];
                            current[index] = { ...current[index], email: e.target.value };
                            form.setValue('members', current);
                          }}
                          value={member.email}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select
                          onValueChange={(v: string) => updateMemberRole(index, v as RoleTitle)}
                          defaultValue={member.role_title}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((role) => (
                              <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {member.role_title === 'Custom' && (
                        <div className="space-y-2">
                          <Label htmlFor={`custom-role-${index}`}>Custom Role Name</Label>
                          <Input
                            id={`custom-role-${index}`}
                            placeholder="e.g., Blockchain Lead"
                            onChange={(e) => {
                              const current = form.getValues('members') || [];
                              current[index] = { ...current[index], custom_role_name: e.target.value };
                              form.setValue('members', current);
                            }}
                            value={member.custom_role_name || ''}
                          />
                        </div>
                      )}

                      <div className="pt-2 border-t">
                        <Label className="font-medium">Permissions</Label>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-2">
                          {PERMISSION_KEYS.map((perm) => (
                            <label key={perm} className="flex items-center gap-2 cursor-pointer">
                              <Switch
                                checked={member[perm] || false}
                                onCheckedChange={(checked) => updateMemberPermission(index, perm, checked)}
                              />
                              <span className="text-sm">{PERMISSION_LABELS[perm]}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeMember(index)} className="text-red-500 hover:text-red-700">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Room Rules</CardTitle>
          <CardDescription>Set strict constraints that the MCP server will enforce</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Tech Stack Locks</Label>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">One rule per line. These will be injected into .cursorrules / AGENTS.md</p>
              <Textarea
                placeholder="No API costs&#10;Native Rust Android only&#10;No external dependencies&#10;TypeScript strict mode required"
                value={(form.watch('tech_stack_locks') || []).join('\n')}
                onChange={(e) => form.setValue('tech_stack_locks', e.target.value.split('\n').filter(Boolean))}
                rows={5}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget_cap">Budget Cap (USD)</Label>
            <Input
              id="budget_cap"
              type="number"
              placeholder="500"
              step="0.01"
              {...form.register('budget_cap', { valueAsNumber: true })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom_agent_instructions">Custom Agent Instructions</Label>
            <Textarea
              id="custom_agent_instructions"
              placeholder="Additional instructions for AI agents (injected into AGENTS.md)..."
              {...form.register('custom_agent_instructions')}
              rows={4}
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium">NIM Automation Settings</h4>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <Switch
                  checked={form.watch('nim_auto_broadcast')}
                  onCheckedChange={(v) => form.setValue('nim_auto_broadcast', v)}
                />
                <div>
                  <p className="font-medium">Auto-Broadcast Mode</p>
                  <p className="text-sm text-muted-foreground">Automatically post NIM summaries to the room instead of saving as drafts</p>
                </div>
              </label>

              <label className="flex items-center gap-3">
                <Switch
                  checked={form.watch('auto_task_progression')}
                  onCheckedChange={(v) => form.setValue('auto_task_progression', v)}
                />
                <div>
                  <p className="font-medium">Auto Task Progression</p>
                  <p className="text-sm text-muted-foreground">Match GitHub commits to tasks and auto-mark as Done</p>
                </div>
              </label>

              <label className="flex items-center gap-3">
                <Switch
                  checked={form.watch('non_tech_translation')}
                  onCheckedChange={(v) => form.setValue('non_tech_translation', v)}
                />
                <div>
                  <p className="font-medium">Non-Technical Translation</p>
                  <p className="text-sm text-muted-foreground">Translate backend commits into plain English for Pitch/Media role</p>
                </div>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <ToastProvider>
      <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Basics', href: '#' },
              { num: 2, label: 'Team/RBAC', href: '#' },
              { num: 3, label: 'Rules', href: '#' },
            ].map((s, i) => (
              <React.Fragment key={s.num}>
                <div className="flex items-center">
                  <div className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors',
                    step > s.num ? 'bg-primary text-primary-foreground' :
                    step === s.num ? 'bg-primary text-primary-foreground' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {step > s.num ? <Check className="w-5 h-5" /> : s.num}
                  </div>
                  {i < 2 && (
                    <div className={cn(
                      'w-16 h-0.5 mx-2',
                      step > s.num ? 'bg-primary' : 'bg-muted'
                    )} />
                  )}
                </div>
              </React.Fragment>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-sm text-muted-foreground">
            <span>Basics</span>
            <span>Team/RBAC</span>
            <span>Rules</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={form.handleSubmit(handleSubmit as any)} className="space-y-6">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
              disabled={step === 1}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleSkip}
                disabled={isSubmitting}
              >
                <SkipForward className="w-4 h-4 mr-2" />
                Skip & Configure Later
              </Button>

              {step < 3 ? (
                <Button type="button" onClick={handleNext} disabled={isSubmitting}>
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Room...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Create Room
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>

        {/* Toast */}
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