'use client';

import { ReactNode } from 'react';
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

interface RoomDashboardLayoutClientProps {
  room: {
    id: string;
    name: string;
    invite_code: string;
  };
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
  const currentPath = pathname.split('/').pop() || 'dashboard';

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
              const isActive = currentPath === item.href || (item.href === 'dashboard' && currentPath === '');
              return (
                <Link
                  key={item.name}
                  href={`/dashboard/rooms/${room.id}/${item.href}`}
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