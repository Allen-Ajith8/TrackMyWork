'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Check, X, Loader2, AlertTriangle, FileText } from 'lucide-react';
import type { Room } from '@/types/database';

interface RoomDetailsClientProps {
  room: Room;
}

export function RoomDetailsClient({ room }: RoomDetailsClientProps) {
  const [supabase] = useState(() => createClient());

  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(room.description || '');
  const [juryExpectations, setJuryExpectations] = useState(room.jury_expectations || '');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setStatus(null);

    setSaving(true);
    (async () => {
      try {
        const { error } = await supabase
          .from('rooms')
          .update({
            description: description.trim() || null,
            jury_expectations: juryExpectations.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', room.id);

        if (error) throw error;

        setStatus({ type: 'success', message: 'Room details saved.' });
        setEditing(false);
      } catch (error) {
        setStatus({
          type: 'error',
          message: error instanceof Error ? error.message : 'Could not save room details.',
        });
      } finally {
        setSaving(false);
      }
    })();
  }

  return (
    <Card className="border border-surface-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4" />
          <CardTitle className="text-sm font-medium">Room Details</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Edit the room description and hackathon expectations visible to the team.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!editing ? (
          <>
            <div className="grid gap-3">
              <div className="col-span-full">
                <p className="text-xs text-surface-500">Description</p>
                <p className="text-surface-700 truncate">
                  {description || 'No description set'}
                </p>
              </div>
              <div className="col-span-full">
                <p className="text-xs text-surface-500">Hackathon Expectations</p>
                <p className="text-surface-700 truncate">
                  {juryExpectations || 'No expectations set'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(true)}>
                Edit Details
              </Button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="room-description">Description</Label>
              <Textarea
                id="room-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What is this room about? e.g. E-commerce hackathon project"
                rows={3}
                disabled={saving}
              />
              <p className="text-xs text-surface-500 mt-1">
                Shown to all team members on the room dashboard.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="room-jury-expectations">Hackathon Expectations</Label>
              <Textarea
                id="room-jury-expectations"
                value={juryExpectations}
                onChange={(event) => setJuryExpectations(event.target.value)}
                placeholder="What will the jury be looking for? e.g. Working prototype, pitch deck, demo video"
                rows={4}
                disabled={saving}
              />
              <p className="text-xs text-surface-500 mt-1">
                Shared with the team so everyone knows what to build toward.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDescription(room.description || '');
                  setJuryExpectations(room.jury_expectations || '');
                  setEditing(false);
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="btn-primary">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Save Details'}
              </Button>
            </div>
            {status && (
              <div
                className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${
                  status.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {status.type === 'success' && <Check className="w-4 h-4" />}
                {status.type === 'error' && <X className="w-4 h-4" />}
                {status.message}
              </div>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
