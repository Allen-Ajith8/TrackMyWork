import { Suspense } from 'react';
import { JoinRoomClient } from '@/components/join-room-client';

export const dynamic = 'force-dynamic';

export default function JoinRoomPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading room invitation...</p>
          </div>
        </div>
      }
    >
      <JoinRoomClient />
    </Suspense>
  );
}
