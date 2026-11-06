import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingScreenProps {
  label?: string;
  sublabel?: string;
  /** Use "page" inside an already-padded dashboard area, "full" for a blank route. */
  variant?: 'page' | 'full';
  className?: string;
}

export function LoadingScreen({
  label = 'Loading your workspace',
  sublabel = 'Getting everything ready…',
  variant = 'page',
  className,
}: LoadingScreenProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-5 text-center',
        variant === 'full' ? 'min-h-screen bg-surface-50' : 'min-h-[60vh]',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl gradient-primary blur-xl opacity-40 animate-pulse" />
        <div className="relative w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-glow-purple animate-pulse-purple">
          <Zap className="w-8 h-8 text-white" />
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-base font-semibold text-surface-900">{label}</p>
        <p className="text-sm text-surface-500">{sublabel}</p>
      </div>

      <div className="h-1.5 w-48 overflow-hidden rounded-full bg-surface-200">
        <div className="h-full w-1/2 rounded-full gradient-primary animate-loading-bar" />
      </div>
    </div>
  );
}
