'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Github,
  Loader2,
  Zap,
  Copy,
  Clock,
  Calendar,
  Shield,
  Sliders,
  Award,
  FileCode,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Users,
  RefreshCw,
  Plus,
  Trash2,
  Info,
  Code,
  Cpu,
} from 'lucide-react';
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
import { useRoomStore } from '@/lib/store';
import type { ProjectType, RoleTitle, RoomPermission, Room } from '@/types/database';

// ============================================================================
// STEP SCHEMAS (Based directly on trackmywork_room_fields.xlsx)
// ============================================================================

// Step 1: Basics & Hackathon Context (Sheet 1: Rows 2-9, Sheet 4: Minimum to Start)
const step1Schema = z.object({
  name: z.string().min(2, 'Room name must be at least 2 characters'),
  hackathon_name: z.string().min(2, 'Hackathon name is required'),
  submission_deadline: z.string().min(1, 'Submission deadline is required (used by Hack-Timer)'),
  problem_statement: z.string().optional(),
  start_date: z.string().optional(),
  description: z.string().optional(),
  hackathon_url: z.string().url('Must be a valid URL (e.g. https://...)').optional().or(z.literal('')),
  github_repo: z.string().url('Must be a valid URL (e.g. https://github.com/owner/repo)').optional().or(z.literal('')),
  hackathon_sheet_row_id: z.string().optional(),
  team_size: z.coerce.number().min(2).max(10).default(4),
  project_type: z.enum(['software', 'hardware', 'hybrid']).default('software'),
});

// Step 2: Team / RBAC (Sheet 1: Rows 10-14, Sheet 2: Role Toggles)
const memberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role_title: z.enum([
    'Team Leader',
    'Frontend',
    'Backend',
    'AI/ML',
    'Pitch/Media',
    'Video Editor',
    'Hardware',
    'Designer',
    'DevOps',
    'Custom',
  ]),
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

// Step 3: Rules & Rubric (Sheet 1: Rows 15-19)
const step3Schema = z.object({
  rules_text: z.string().optional(),
  judging_rubric: z.string().optional(),
  allowed_tech: z.string().optional(),
  submission_format: z.string().optional(),
  tech_stack_locks: z.array(z.string()).optional(),
  budget_cap: z.preprocess(
    (value) =>
      value === '' || value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value))
        ? undefined
        : value,
    z.coerce.number().optional()
  ),
  custom_agent_instructions: z.string().optional(),
  nim_auto_broadcast: z.boolean().default(false),
  auto_task_progression: z.boolean().default(true),
  non_tech_translation: z.boolean().default(true),
});

const fullSchema = step1Schema.merge(step2Schema).merge(step3Schema);
type FullFormData = z.infer<typeof fullSchema>;

// Role presets matching Excel specifications & Discord-style RBAC
const ROLE_OPTIONS: { value: RoleTitle; label: string; defaultPermissions: Partial<Record<RoomPermission, boolean>> }[] = [
  { value: 'Frontend', label: 'Frontend Dev', defaultPermissions: { can_edit_repo: true, can_assign_tasks: true } },
  { value: 'Backend', label: 'Backend Dev', defaultPermissions: { can_edit_repo: true, can_trigger_nim: true, can_assign_tasks: true } },
  { value: 'AI/ML', label: 'AI/ML Specialist', defaultPermissions: { can_edit_repo: true, can_trigger_nim: true } },
  { value: 'Pitch/Media', label: 'Pitch / Media Lead', defaultPermissions: { can_upload_assets: true, can_invite_members: true } },
  { value: 'Video Editor', label: 'Video Editor', defaultPermissions: { can_upload_assets: true } },
  { value: 'Hardware', label: 'Hardware Lead', defaultPermissions: { can_edit_repo: true, can_manage_bom: true } },
  { value: 'Designer', label: 'UI/UX Designer', defaultPermissions: { can_upload_assets: true } },
  { value: 'DevOps', label: 'DevOps & Cloud', defaultPermissions: { can_edit_repo: true, can_trigger_nim: true, can_assign_tasks: true, can_manage_bom: true } },
  { value: 'Custom', label: 'Custom Role', defaultPermissions: {} },
];

// The 7 RBAC Permission Toggles defined in Sheet 2: "Role Toggles"
const PERMISSION_KEYS: RoomPermission[] = [
  'can_edit_repo',
  'can_trigger_nim',
  'can_assign_tasks',
  'can_upload_assets',
  'can_manage_bom',
  'can_invite_members',
  'can_edit_rules',
];

const PERMISSION_LABELS: Record<RoomPermission, { title: string; desc: string }> = {
  can_edit_repo: { title: 'can_edit_repo', desc: 'Push commits and open pull requests' },
  can_trigger_nim: { title: 'can_trigger_nim', desc: 'Trigger NVIDIA NIM AI sweeps and analysis' },
  can_assign_tasks: { title: 'can_assign_tasks', desc: 'Assign and modify task priorities' },
  can_upload_assets: { title: 'can_upload_assets', desc: 'Upload design mockups and videos' },
  can_manage_bom: { title: 'can_manage_bom', desc: 'Edit hardware bill of materials & parts' },
  can_invite_members: { title: 'can_invite_members', desc: 'Generate invites and add teammates' },
  can_edit_rules: { title: 'can_edit_rules', desc: 'Modify hackathon rules & tech locks' },
};

export function RoomCreationWizard() {
  const router = useRouter();
  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [connectGithub, setConnectGithub] = React.useState(false);
  const [inviteCode, setInviteCode] = React.useState(generateInviteCode());
  const [copiedCode, setCopiedCode] = React.useState(false);
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; title: string; message: string } | null>(null);

  const supabase = createClient();
  const { setCurrentRoom } = useRoomStore();

  const form = useForm<FullFormData>({
    resolver: zodResolver(fullSchema) as any,
    mode: 'onChange',
    defaultValues: {
      name: '',
      hackathon_name: '',
      submission_deadline: '',
      problem_statement: '',
      start_date: '',
      description: '',
      hackathon_url: '',
      github_repo: '',
      hackathon_sheet_row_id: '',
      team_size: 4,
      project_type: 'software',
      members: [],
      rules_text: '',
      judging_rubric: '',
      allowed_tech: '',
      submission_format: '',
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
  const watchName = form.watch('name');
  const watchHackathon = form.watch('hackathon_name');
  const watchDeadline = form.watch('submission_deadline');

  const hasMinimumFields = Boolean(watchName && watchHackathon && watchDeadline);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleRegenerateCode = () => {
    setInviteCode(generateInviteCode());
  };

  const addMember = () => {
    const current = form.getValues('members') || [];
    form.setValue('members', [
      ...current,
      {
        email: '',
        role_title: 'Frontend',
        can_edit_repo: true,
        can_trigger_nim: false,
        can_assign_tasks: true,
        can_upload_assets: false,
        can_manage_bom: false,
        can_invite_members: false,
        can_edit_rules: false,
      },
    ]);
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
    const roleConfig = ROLE_OPTIONS.find((r) => r.value === role);
    const updated = [...current];
    updated[index] = {
      ...updated[index],
      role_title: role,
      custom_role_name: role === 'Custom' ? updated[index].custom_role_name : undefined,
      ...roleConfig?.defaultPermissions,
    };
    form.setValue('members', updated);
  };

  // Step Navigation Validation
  const handleNext = async () => {
    if (step === 1) {
      const valid = await form.trigger(['name', 'hackathon_name', 'submission_deadline']);
      if (!valid) return;
      setStep(2);
    } else if (step === 2) {
      const valid = await form.trigger('members');
      if (!valid) return;
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as any);
    }
  };

  // Submit Handler: Saves room, rules, members, and handles demo-mode fallback gracefully
  const handleCreateRoom = async (isQuickStart = false) => {
    if (isQuickStart) {
      const valid = await form.trigger(['name', 'hackathon_name', 'submission_deadline']);
      if (!valid) {
        setToast({
          type: 'error',
          title: 'Minimum Fields Required',
          message: 'Please provide Room name, Hackathon name, and Submission deadline to quick-start.',
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const data = form.getValues();
      const code = inviteCode || generateInviteCode();

      // Resolve user id (authenticated or demo-mode)
      let userId = 'demo-dev-user-001';
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          userId = authData.user.id;
        }
      } catch {
        // Fallback for offline demo mode
      }

      // Base room payload that aligns with schema.sql
      const basePayload: any = {
        name: data.name,
        description: data.description || data.problem_statement || null,
        invite_code: code,
        hackathon_sheet_row_id: data.hackathon_sheet_row_id || null,
        github_repo: data.github_repo || null,
        team_size: data.team_size,
        project_type: data.project_type,
        is_setup_complete: true,
        jury_expectations: data.judging_rubric || data.custom_agent_instructions || data.rules_text || '',
        created_by: userId,
      };

      // Extended fields from Excel sheet (Room Fields)
      const extendedPayload: any = {
        ...basePayload,
        hackathon_name: data.hackathon_name,
        problem_statement: data.problem_statement || null,
        start_date: data.start_date || null,
        deadline: data.submission_deadline || null,
        submission_deadline: data.submission_deadline || null,
        hackathon_url: data.hackathon_url || null,
        submission_format: data.submission_format || null,
        rules_text: data.rules_text || null,
        judging_rubric: data.judging_rubric || null,
        allowed_tech: data.allowed_tech || null,
      };

      let newRoomId = '';

      // Create room via server API route to guarantee persistence in custom_rooms.json + Supabase
      try {
        const createRes = await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...extendedPayload,
            invite_code: code,
            custom_agent_instructions: data.custom_agent_instructions,
            budget_cap: data.budget_cap,
            tech_stack_locks: data.tech_stack_locks,
          }),
        });
        const createJson = await createRes.json();
        if (createJson.room?.id) {
          newRoomId = createJson.room.id;
        }
      } catch (apiErr) {
        console.warn('API room creation error:', apiErr);
      }

      if (!newRoomId) {
        // Fallback to Supabase direct insert or local ID
        try {
          const { data: room, error } = await supabase
            .from('rooms')
            .insert(extendedPayload)
            .select()
            .single();

          if (error) {
            const { data: baseRoom, error: baseErr } = await supabase
              .from('rooms')
              .insert(basePayload)
              .select()
              .single();

            if (baseErr) throw baseErr;
            newRoomId = baseRoom.id;
          } else {
            newRoomId = room.id;
          }
        } catch {
          newRoomId = `room-${Date.now()}`;
        }
      }

      // Insert Room Rules (Constraints & NIM configuration)
      try {
        const techLocks = [
          ...(data.tech_stack_locks || []),
          ...(data.allowed_tech ? data.allowed_tech.split('\n').filter(Boolean) : []),
        ];

        await supabase.from('room_rules').insert({
          room_id: newRoomId,
          tech_stack_locks: techLocks,
          budget_cap: data.budget_cap,
          custom_agent_instructions: [
            data.custom_agent_instructions,
            data.rules_text ? `Official Rules:\n${data.rules_text}` : '',
            data.judging_rubric ? `Judging Rubric:\n${data.judging_rubric}` : '',
            data.submission_format ? `Submission Format: ${data.submission_format}` : '',
          ].filter(Boolean).join('\n\n'),
          nim_auto_broadcast: data.nim_auto_broadcast,
          auto_task_progression: data.auto_task_progression,
          non_tech_translation: data.non_tech_translation,
        });
      } catch {
        // Skip rule table error in demo mode
      }

      // Add Creator as Team Leader with full RBAC permissions (Sheet 1: Row 10)
      try {
        await supabase.from('room_members').insert({
          room_id: newRoomId,
          user_id: userId,
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
      } catch {
        // Skip member table error in demo mode
      }

      // Dispatch Supabase email invitations for entered teammates (Sheet 1: Rows 12-14)
      if (data.members && data.members.length > 0) {
        for (const member of data.members) {
          if (member.email && member.email.trim()) {
            try {
              await fetch(`/api/rooms/${newRoomId}/invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: member.email.trim(),
                  role_title: member.role_title,
                  custom_role_name: member.custom_role_name,
                  permissions: {
                    can_edit_repo: member.can_edit_repo,
                    can_trigger_nim: member.can_trigger_nim,
                    can_assign_tasks: member.can_assign_tasks,
                    can_upload_assets: member.can_upload_assets,
                    can_manage_bom: member.can_manage_bom,
                    can_invite_members: member.can_invite_members,
                    can_edit_rules: member.can_edit_rules,
                  },
                }),
              });
            } catch (inviteErr) {
              console.warn('[Room Creation] Could not dispatch email invite to:', member.email, inviteErr);
            }
          }
        }
      }

      // Update in-memory room store
      const createdRoom: Room = {
        id: newRoomId,
        name: data.name,
        description: data.description || data.problem_statement || null,
        invite_code: code,
        hackathon_name: data.hackathon_name,
        problem_statement: data.problem_statement || null,
        start_date: data.start_date || null,
        deadline: data.submission_deadline || null,
        submission_deadline: data.submission_deadline || null,
        hackathon_url: data.hackathon_url || null,
        submission_format: data.submission_format || null,
        rules_text: data.rules_text || null,
        judging_rubric: data.judging_rubric || null,
        allowed_tech: data.allowed_tech || null,
        hackathon_sheet_row_id: data.hackathon_sheet_row_id || null,
        github_repo: data.github_repo || null,
        github_installation_id: null,
        team_size: data.team_size,
        is_setup_complete: true,
        jury_expectations: data.judging_rubric || data.custom_agent_instructions || null,
        project_type: data.project_type,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setCurrentRoom(createdRoom);

      setToast({
        type: 'success',
        title: 'Room Created Successfully!',
        message: `Invite code: ${code}. Redirecting to your room dashboard...`,
      });

      if (connectGithub) {
        window.location.assign(`/dashboard/rooms/${encodeURIComponent(newRoomId)}?connectGithub=true`);
        return;
      }

      setTimeout(() => router.push(`/dashboard/rooms/${newRoomId}`), 1200);
    } catch (err) {
      setToast({
        type: 'error',
        title: 'Error Creating Room',
        message: err instanceof Error ? err.message : 'Failed to create room. Please check your inputs.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================================================
  // RENDER STEP 1: BASICS & HACKATHON CONTEXT
  // ==========================================================================
  const renderStep1 = () => (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <Card className="border-2 border-surface-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <span>Step 1: Basics & Hackathon Setup</span>
                <Badge className="bg-primary-50 text-primary-700 border-primary-200 text-xs">
                  Excel Sheet 1
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Essential project identifiers, hackathon deadlines, and repository configurations.
              </CardDescription>
            </div>
            {hasMinimumFields && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleCreateRoom(true)}
                disabled={isSubmitting}
                className="text-xs font-semibold border-emerald-300 text-emerald-800 hover:bg-emerald-50"
              >
                <Zap className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                Quick Launch Room (Minimum to Start)
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Room Name */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="name" className="text-xs font-bold text-surface-900 flex items-center gap-1.5">
                <span>Room Name</span>
                <span className="text-rose-500 font-black">*</span>
              </Label>
              <Badge variant="destructive" className="text-[10px] uppercase font-mono px-2 py-0.5">
                Required
              </Badge>
            </div>
            <Input
              id="name"
              placeholder="e.g. Team Phoenix: Smart India Hackathon"
              {...form.register('name')}
              className="text-sm font-medium"
            />
            {form.formState.errors.name && (
              <p className="text-xs font-semibold text-rose-600">{form.formState.errors.name.message}</p>
            )}
          </div>

          {/* Hackathon Name & Submission Deadline */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="hackathon_name" className="text-xs font-bold text-surface-900 flex items-center gap-1.5">
                  <span>Hackathon Name</span>
                  <span className="text-rose-500 font-black">*</span>
                </Label>
                <Badge variant="destructive" className="text-[10px] uppercase font-mono px-2 py-0.5">
                  Required
                </Badge>
              </div>
              <Input
                id="hackathon_name"
                placeholder="e.g. Smart India Hackathon 2026"
                {...form.register('hackathon_name')}
                className="text-sm"
              />
              {form.formState.errors.hackathon_name && (
                <p className="text-xs font-semibold text-rose-600">{form.formState.errors.hackathon_name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="submission_deadline" className="text-xs font-bold text-surface-900 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Submission Deadline</span>
                  <span className="text-rose-500 font-black">*</span>
                </Label>
                <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] uppercase font-mono px-2 py-0.5">
                  Hack-Timer
                </Badge>
              </div>
              <Input
                id="submission_deadline"
                type="datetime-local"
                {...form.register('submission_deadline')}
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Hard submission cutoff. The live Hack-Timer reads this timestamp directly.
              </p>
              {form.formState.errors.submission_deadline && (
                <p className="text-xs font-semibold text-rose-600">{form.formState.errors.submission_deadline.message}</p>
              )}
            </div>
          </div>

          {/* Problem Statement */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="problem_statement" className="text-xs font-bold text-surface-900 flex items-center gap-1.5">
                <span>Project / Problem Statement</span>
              </Label>
              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-mono px-2 py-0.5">
                Recommended
              </Badge>
            </div>
            <Textarea
              id="problem_statement"
              placeholder="e.g. Detect plant diseases from leaf photos to help rural farmers with real-time offline AI diagnosis"
              rows={2}
              {...form.register('problem_statement')}
              className="text-sm leading-relaxed"
            />
            <p className="text-[11px] text-muted-foreground">
              Core problem chosen from the hackathon track. NIM AI uses this to evaluate scope.
            </p>
          </div>

          {/* Start Date & Project Description */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="start_date" className="text-xs font-medium text-surface-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Start Date & Time (Optional)</span>
                </Label>
                <span className="text-[10px] text-muted-foreground">Optional</span>
              </div>
              <Input
                id="start_date"
                type="datetime-local"
                {...form.register('start_date')}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="hackathon_url" className="text-xs font-medium text-surface-700">
                  Hackathon Website URL (Optional)
                </Label>
                <span className="text-[10px] text-muted-foreground">Optional</span>
              </div>
              <Input
                id="hackathon_url"
                placeholder="https://hackathon-site.com/event"
                {...form.register('hackathon_url')}
                className="text-sm"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="description" className="text-xs font-medium text-surface-700">
                Project Description (Optional)
              </Label>
              <span className="text-[10px] text-muted-foreground">Optional</span>
            </div>
            <Textarea
              id="description"
              placeholder="e.g. AI-based crop disease detector with automated offline scanning and sensor telemetry..."
              rows={2}
              {...form.register('description')}
              className="text-sm leading-relaxed"
            />
          </div>

          {/* GitHub Repo */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <Label htmlFor="github_repo" className="text-xs font-bold text-surface-900 flex items-center gap-1.5">
                <Github className="w-4 h-4 text-surface-800" />
                <span>GitHub Repository URL (Optional)</span>
              </Label>
              <span className="text-[10px] text-muted-foreground">Can be set later in Settings</span>
            </div>
            <Input
              id="github_repo"
              placeholder="https://github.com/yourname/phoenix-app"
              {...form.register('github_repo')}
              className="text-sm font-mono"
            />
            {form.formState.errors.github_repo && (
              <p className="text-xs font-semibold text-rose-600">{form.formState.errors.github_repo.message}</p>
            )}

            <label className="flex items-start gap-3 rounded-xl border border-surface-200 bg-surface-50 p-3 mt-2 cursor-pointer hover:bg-surface-100 transition-colors">
              <Switch
                checked={connectGithub}
                onCheckedChange={setConnectGithub}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-surface-900 flex items-center gap-1.5">
                  <Github className="w-3.5 h-3.5" />
                  Connect GitHub App after room creation
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Installs real-time commit webhooks to auto-progress tasks and run AI code audits.
                </p>
              </div>
            </label>
          </div>

          {/* Project Type & Team Size */}
          <div className="space-y-3 pt-3 border-t">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-surface-900">Project Type</Label>
                <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {watchProjectType === 'hardware' ? '⚙️ Hardware: BOM tab enabled' : '💻 Software: BOM tab excluded'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => form.setValue('project_type', 'software')}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-all',
                    watchProjectType === 'software'
                      ? 'border-primary-600 bg-primary-50/50 ring-2 ring-primary-500/20'
                      : 'border-surface-200 hover:border-surface-300 bg-white'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Code className="w-4 h-4 text-primary-600" />
                    <span className="font-semibold text-xs text-surface-900">Software Project</span>
                  </div>
                  <p className="text-[11px] text-surface-500 leading-tight">
                    Web, mobile, cloud, AI. Bill of Materials (BOM) is excluded.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => form.setValue('project_type', 'hardware')}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-all',
                    watchProjectType === 'hardware'
                      ? 'border-amber-600 bg-amber-50/50 ring-2 ring-amber-500/20'
                      : 'border-surface-200 hover:border-surface-300 bg-white'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Cpu className="w-4 h-4 text-amber-600" />
                    <span className="font-semibold text-xs text-surface-900">Hardware Project</span>
                  </div>
                  <p className="text-[11px] text-surface-500 leading-tight">
                    IoT, sensors, electronics. Bill of Materials (BOM) is included.
                  </p>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-surface-900">Max Team Size</Label>
              <Select
                onValueChange={(v: string) => form.setValue('team_size', Number(v))}
                defaultValue={watchTeamSize.toString()}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n} Members
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ==========================================================================
  // RENDER STEP 2: TEAM & RBAC PERMISSIONS (SHEET 1 & SHEET 2)
  // ==========================================================================
  const renderStep2 = () => (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Team Leader & Invite Code Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Team Leader Card (Sheet 1: Row 10) */}
        <Card className="border border-surface-200 bg-surface-50/70">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-surface-700 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-primary-600" />
                <span>Team Leader (Required)</span>
              </CardTitle>
              <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px] font-mono">
                You (Creator)
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-1.5 text-xs text-surface-700">
            <p className="font-semibold text-surface-900">Full Administrative Access</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              As room creator, you automatically possess all 7 RBAC permissions, rule editing privileges, and repository management.
            </p>
          </CardContent>
        </Card>

        {/* 6-Digit Invite Code Card (Sheet 1: Row 11) */}
        <Card className="border border-primary-200 bg-primary-50/40">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-primary-900 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary-600" />
                <span>6-Digit Invite Code</span>
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRegenerateCode}
                className="h-6 px-1.5 text-[11px] text-primary-700 hover:bg-primary-100"
                title="Generate new 6-digit code"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Regen
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2">
            <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-primary-200 shadow-xs">
              <span className="text-lg font-black tracking-widest font-mono text-primary-900 px-2">
                {inviteCode}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCopyCode}
                className="h-7 text-xs font-bold gap-1"
              >
                {copiedCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
              </Button>
            </div>
            <p className="text-[11px] text-primary-800">
              Teammates enter this 6-digit code on their dashboard to join this room instantly.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Teammate Invites & Role Toggles (Sheet 1: Rows 12-14, Sheet 2: Role Toggles) */}
      <Card className="border-2 border-surface-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <span>Invite Teammates & Configure RBAC</span>
                <Badge className="bg-primary-50 text-primary-700 border-primary-200 text-xs">
                  Excel Sheet 2
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Assign custom roles and configure Discord-style permission switches for every teammate.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addMember}
              className="text-xs font-bold gap-1.5 bg-white shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 text-primary-600" />
              <span>Add Teammate</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {watchMembers.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-surface-300 space-y-3">
              <Users className="w-10 h-10 mx-auto text-surface-400" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-surface-900">No external teammates added yet</p>
                <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
                  You can invite teammates now by email and pre-set their RBAC toggles, or simply share your 6-digit invite code (
                  <strong className="text-primary-800 font-mono">{inviteCode}</strong>) after creation.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMember}
                className="text-xs font-bold"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add First Teammate
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {watchMembers.map((member, index) => (
                <div
                  key={index}
                  className="rounded-2xl border-2 border-surface-200 bg-white p-4 space-y-4 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid gap-3 sm:grid-cols-2 flex-1">
                      {/* Teammate Email */}
                      <div className="space-y-1">
                        <Label htmlFor={`member-email-${index}`} className="text-xs font-bold text-surface-900">
                          Teammate Email *
                        </Label>
                        <Input
                          id={`member-email-${index}`}
                          placeholder="teammate@gmail.com"
                          value={member.email}
                          onChange={(e) => {
                            const current = form.getValues('members') || [];
                            current[index] = { ...current[index], email: e.target.value };
                            form.setValue('members', current);
                          }}
                          className="text-xs"
                        />
                      </div>

                      {/* Role Selector */}
                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-surface-900">Assigned Role</Label>
                        <Select
                          onValueChange={(v: string) => updateMemberRole(index, v as RoleTitle)}
                          defaultValue={member.role_title}
                        >
                          <SelectTrigger className="text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((role) => (
                              <SelectItem key={role.value} value={role.value} className="text-xs">
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMember(index)}
                      className="text-surface-400 hover:text-rose-600 h-8 w-8 shrink-0"
                      title="Remove teammate"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Custom Role Input */}
                  {member.role_title === 'Custom' && (
                    <div className="space-y-1 p-3 rounded-xl bg-surface-50 border border-surface-200">
                      <Label htmlFor={`custom-role-${index}`} className="text-xs font-bold text-surface-900">
                        Custom Role Name (e.g. Hardware Lead, Blockchain Lead)
                      </Label>
                      <Input
                        id={`custom-role-${index}`}
                        placeholder="e.g. Hardware Lead"
                        value={member.custom_role_name || ''}
                        onChange={(e) => {
                          const current = form.getValues('members') || [];
                          current[index] = { ...current[index], custom_role_name: e.target.value };
                          form.setValue('members', current);
                        }}
                        className="text-xs bg-white"
                      />
                    </div>
                  )}

                  {/* 7 Discord-style RBAC Permission Toggles (Sheet 2) */}
                  <div className="pt-3 border-t border-surface-100 space-y-2">
                    <span className="text-xs font-bold text-surface-800 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-primary-600" />
                      <span>Role Permissions (Excel Sheet 2 Toggles)</span>
                    </span>

                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {PERMISSION_KEYS.map((perm) => (
                        <label
                          key={perm}
                          className="flex items-start gap-2.5 p-2 rounded-xl bg-surface-50 border border-surface-200 cursor-pointer hover:bg-surface-100 transition-colors"
                        >
                          <Switch
                            checked={member[perm] || false}
                            onCheckedChange={(checked) => updateMemberPermission(index, perm, checked)}
                            className="mt-0.5"
                          />
                          <div className="min-w-0">
                            <span className="text-[11px] font-mono font-bold block text-surface-900 truncate">
                              {PERMISSION_LABELS[perm].title}
                            </span>
                            <span className="text-[10px] text-muted-foreground block leading-tight">
                              {PERMISSION_LABELS[perm].desc}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ==========================================================================
  // RENDER STEP 3: RULES & RUBRIC (SHEET 1: ROWS 15-19)
  // ==========================================================================
  const renderStep3 = () => (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <Card className="border-2 border-surface-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <span>Step 3: Hackathon Rules & Judging Rubric</span>
            <Badge className="bg-primary-50 text-primary-700 border-primary-200 text-xs">
              Excel Sheet 1 (Rows 15–19)
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Paste official rules and evaluation rubrics. NIM AI uses these to detect scope creep and drive Mock Jury evaluations.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Note from Excel Sheet */}
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-950">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-bold">Setup Note from Excel Reference:</strong>
              <p className="leading-relaxed text-[11px] text-amber-900">
                Rubric and rules matter most because NVIDIA NIM scope-creep detection and Mock Jury Q&A score backlog tasks and commits directly against them.
              </p>
            </div>
          </div>

          {/* Official Rules / Problem Statement Text (Sheet 1: Row 15) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="rules_text" className="text-xs font-bold text-surface-900 flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-primary-600" />
                <span>Rules / Problem Statement Text</span>
              </Label>
              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-mono px-2 py-0.5">
                Recommended
              </Badge>
            </div>
            <Textarea
              id="rules_text"
              placeholder="Paste the official rules, constraints, or problem statement guidelines from the hackathon brochure..."
              rows={4}
              {...form.register('rules_text')}
              className="text-xs font-mono leading-relaxed"
            />
          </div>

          {/* Judging Criteria / Rubric (Sheet 1: Row 16) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="judging_rubric" className="text-xs font-bold text-surface-900 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-600" />
                <span>Judging Criteria / Rubric</span>
              </Label>
              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-mono px-2 py-0.5">
                Recommended
              </Badge>
            </div>
            <Textarea
              id="judging_rubric"
              placeholder="e.g. Innovation 30%, Feasibility 25%, Impact 25%, Presentation 20%"
              rows={3}
              {...form.register('judging_rubric')}
              className="text-xs font-mono leading-relaxed"
            />
            <p className="text-[11px] text-muted-foreground">
              Official judge evaluation weightages. NIM compares sprint tasks against this breakdown.
            </p>
          </div>

          {/* Allowed Tech / Constraints (Sheet 1: Row 17) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="allowed_tech" className="text-xs font-bold text-surface-900 flex items-center gap-1.5">
                <span>Allowed Tech or Constraints</span>
              </Label>
              <span className="text-[10px] text-muted-foreground">Optional (Injected into .cursorrules)</span>
            </div>
            <Textarea
              id="allowed_tech"
              placeholder="Must use open-source only&#10;No paid APIs&#10;Native Rust Android only&#10;TypeScript strict mode required"
              rows={3}
              {...form.register('allowed_tech')}
              className="text-xs font-mono leading-relaxed"
            />
          </div>

          {/* Submission Format & Budget Cap (Sheet 1: Rows 18-19) */}
          <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t">
            <div className="space-y-1.5">
              <Label htmlFor="submission_format" className="text-xs font-medium text-surface-900">
                Submission Format (Optional)
              </Label>
              <Input
                id="submission_format"
                placeholder="e.g. APK + 3 min demo video + PPT"
                {...form.register('submission_format')}
                className="text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Deliverables required at final submission.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="budget_cap" className="text-xs font-medium text-surface-900">
                Budget Cap in USD (Optional)
              </Label>
              <Input
                id="budget_cap"
                type="number"
                placeholder="500"
                step="0.01"
                {...form.register('budget_cap', { valueAsNumber: true })}
                className="text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Maximum hardware BOM / cloud budget ceiling.</p>
            </div>
          </div>

          {/* NIM Automation Toggles */}
          <div className="space-y-3 pt-3 border-t">
            <h4 className="text-xs font-black uppercase tracking-wider text-surface-800">
              NVIDIA NIM Automation Settings
            </h4>

            <div className="space-y-2.5">
              <label className="flex items-start gap-3 p-2.5 rounded-xl bg-surface-50 border border-surface-200 cursor-pointer">
                <Switch
                  checked={form.watch('nim_auto_broadcast')}
                  onCheckedChange={(v) => form.setValue('nim_auto_broadcast', v)}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-surface-900">Auto-Broadcast Mode</p>
                  <p className="text-[11px] text-muted-foreground">
                    Automatically publish verified NIM summaries to room feed instead of saving as drafts.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-2.5 rounded-xl bg-surface-50 border border-surface-200 cursor-pointer">
                <Switch
                  checked={form.watch('auto_task_progression')}
                  onCheckedChange={(v) => form.setValue('auto_task_progression', v)}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-surface-900">Auto Task Progression</p>
                  <p className="text-[11px] text-muted-foreground">
                    Match GitHub pull requests and commit hashes to tasks and auto-mark as Done.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-2.5 rounded-xl bg-surface-50 border border-surface-200 cursor-pointer">
                <Switch
                  checked={form.watch('non_tech_translation')}
                  onCheckedChange={(v) => form.setValue('non_tech_translation', v)}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-surface-900">Non-Technical Translation</p>
                  <p className="text-[11px] text-muted-foreground">
                    Translate backend commits and PR code diffs into plain English updates for Pitch & Media leads.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ==========================================================================
  // RENDER STEP 4: REVIEW & LAUNCH (SHEET 3 & SHEET 4)
  // ==========================================================================
  const renderStep4 = () => {
    const values = form.getValues();

    return (
      <div className="space-y-6 animate-in fade-in-50 duration-200">
        {/* Minimum to Start Card (Sheet 4) */}
        <Card className="border-2 border-emerald-300 bg-emerald-50/40 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-emerald-950 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Ready to Launch Hackathon Room</span>
              </CardTitle>
              <Badge className="bg-emerald-600 text-white font-mono text-[10px]">
                Excel Sheet 4 Verified
              </Badge>
            </div>
            <CardDescription className="text-xs text-emerald-900">
              All essential parameters have been captured according to your setup specifications.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3 text-xs">
              <div className="p-3 rounded-xl bg-white border border-emerald-200 space-y-1">
                <span className="text-[10px] font-mono uppercase text-muted-foreground block font-bold">Room Name</span>
                <span className="font-bold text-surface-900 block truncate">{values.name || 'Untitled Room'}</span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-emerald-200 space-y-1">
                <span className="text-[10px] font-mono uppercase text-muted-foreground block font-bold">Hackathon</span>
                <span className="font-bold text-surface-900 block truncate">{values.hackathon_name || 'Hackathon 2026'}</span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-emerald-200 space-y-1">
                <span className="text-[10px] font-mono uppercase text-muted-foreground block font-bold">Submission Deadline</span>
                <span className="font-bold text-amber-700 block truncate">{values.submission_deadline || 'Not set'}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white border border-emerald-200 text-xs text-surface-700 flex items-center justify-between">
              <span>
                <strong>Invite Code:</strong> <span className="font-mono font-bold text-primary-700">{inviteCode}</span>
              </span>
              <span>
                <strong>Team Size:</strong> {values.team_size} members ({values.project_type})
              </span>
            </div>
          </CardContent>
        </Card>

        {/* After Creation Guide (Sheet 3) */}
        <Card className="border border-surface-200 bg-white shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-surface-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary-600" />
              <span>After Creation Integration Checklist (Excel Sheet 3)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="p-2.5 rounded-xl bg-surface-50 border border-surface-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary-600 shrink-0" />
                <span>
                  <strong>GitHub App Webhook:</strong> Set in Room &gt; Settings &gt; Repository
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-50 border border-surface-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary-600 shrink-0" />
                <span>
                  <strong>Discord Webhook URL:</strong> Configure under Room Settings
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-50 border border-surface-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary-600 shrink-0" />
                <span>
                  <strong>Canva Slide Deck:</strong> Link in Room Settings
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-50 border border-surface-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary-600 shrink-0" />
                <span>
                  <strong>Google Sheets Tracker:</strong> Sync in Room Settings
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // ==========================================================================
  // MAIN WIZARD CONTAINER
  // ==========================================================================
  return (
    <ToastProvider>
      <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
        {/* Wizard Header Bar */}
        <div className="mb-6 space-y-1 text-center sm:text-left">
          <h1 className="text-2xl font-black tracking-tight text-surface-900 flex items-center justify-center sm:justify-start gap-2.5">
            <span>Create Hackathon Room</span>
            <Badge className="bg-primary-50 text-primary-700 border-primary-200 font-mono text-xs">
              Wizard
            </Badge>
          </h1>
          <p className="text-xs text-muted-foreground">
            Configure your project workspace, team RBAC, and hackathon rules as specified in your setup guide.
          </p>
        </div>

        {/* 4-Step Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Basics' },
              { num: 2, label: 'Team/RBAC' },
              { num: 3, label: 'Rules' },
              { num: 4, label: 'Launch' },
            ].map((s, i) => (
              <React.Fragment key={s.num}>
                <div className="flex items-center">
                  <div
                    onClick={() => {
                      if (s.num <= step) setStep(s.num as any);
                    }}
                    className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all cursor-pointer',
                      step > s.num
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : step === s.num
                        ? 'bg-primary-600 text-white ring-4 ring-primary-100 shadow-sm'
                        : 'bg-surface-100 text-surface-400 border border-surface-200'
                    )}
                  >
                    {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                  </div>
                  {i < 3 && (
                    <div
                      className={cn(
                        'w-12 sm:w-24 h-1 mx-2 rounded-full transition-colors',
                        step > s.num ? 'bg-emerald-500' : 'bg-surface-200'
                      )}
                    />
                  )}
                </div>
              </React.Fragment>
            ))}
          </div>

          <div className="flex justify-between mt-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            <span>1. Basics</span>
            <span>2. Team & RBAC</span>
            <span>3. Rules & Rubric</span>
            <span>4. Review</span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-5 border-t border-surface-200 flex-wrap gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
              disabled={step === 1 || isSubmitting}
              className="text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back
            </Button>

            <div className="flex items-center gap-2.5">
              {/* Quick Launch Button (Sheet 4) */}
              {hasMinimumFields && step < 4 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleCreateRoom(true)}
                  disabled={isSubmitting}
                  className="text-xs font-bold text-surface-700 hover:text-surface-900 border-surface-300 shadow-xs"
                >
                  <Zap className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                  Quick Launch (Minimum Fields)
                </Button>
              )}

              {step < 4 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={isSubmitting}
                  className="text-xs font-bold gap-1 px-5"
                >
                  <span>Next Step</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => handleCreateRoom(false)}
                  disabled={isSubmitting}
                  className="text-xs font-black px-6 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white shadow-md transition-all hover:scale-105 active:scale-95"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Hackathon Room...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2 text-amber-300" />
                      Create Hackathon Room
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>

        <ToastViewport />
      </div>

      {toast && (
        <Toast className={toast.type === 'error' ? 'border-rose-400 bg-rose-50 text-rose-950' : 'border-emerald-400 bg-emerald-50 text-emerald-950'}>
          <ToastTitle className="text-xs font-bold">{toast.title}</ToastTitle>
          <ToastDescription className="text-xs">{toast.message}</ToastDescription>
        </Toast>
      )}
    </ToastProvider>
  );
}
