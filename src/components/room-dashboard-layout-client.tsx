'use client';

import { ReactNode, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Kanban,
  Package,
  FileImage,
  Users,
  Settings,
  HelpCircle,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRoomStore } from '@/lib/store';
import type { Room } from '@/types/database';

interface RoomDashboardLayoutClientProps {
  room: Room;
  children: ReactNode;
}

const roomNavItems = [
  { name: 'Dashboard', href: 'dashboard', icon: LayoutDashboard },
  { name: 'Tasks', href: 'tasks', icon: Kanban },
  { name: 'BOM', href: 'bom', icon: Package },
  { name: 'Artifacts', href: 'artifacts', icon: FileImage },
  { name: 'Team', href: 'team', icon: Users },
  { name: 'Settings', href: 'settings', icon: Settings },
];

export function RoomDashboardLayoutClient({ room, children }: RoomDashboardLayoutClientProps) {
  const pathname = usePathname();
  const basePath = `/dashboard/rooms/${room.id}`;
  const setCurrentRoom = useRoomStore((state) => state.setCurrentRoom);

  // Keep the active room in the store for every room sub-page so live IDE
  // telemetry (heartbeats/file locks) is scoped to the room being viewed.
  useEffect(() => {
    setCurrentRoom(room);
  }, [room, setCurrentRoom]);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Room Sub-navigation */}
      <nav className="border-b bg-white px-4 flex-shrink-0">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/rooms" className="btn-ghost p-2 hover:bg-muted rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h2 className="font-semibold">{room.name}</h2>
              <p className="text-xs text-muted-foreground">Invite: {room.invite_code}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {roomNavItems.map(item => {
              const href = item.href === 'dashboard' ? basePath : `${basePath}/${item.href}`;
              const isActive = item.href === 'dashboard'
                ? pathname === basePath
                : pathname.startsWith(`${basePath}/${item.href}`);
              return (
                <Link
                  key={item.name}
                  href={href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}