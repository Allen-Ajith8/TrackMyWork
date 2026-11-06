'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { getInitials } from '@/lib/utils';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  fallback?: string;
}

function Avatar({ className, src, alt, fallback, ...props }: AvatarProps) {
  return (
    <div
      className={cn(
        'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
        className
      )}
      {...props}
    >
      {src ? (
        <img
          className="aspect-square h-full w-full object-cover"
          src={src}
          alt={alt || fallback || 'Avatar'}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-muted">
          <span className="text-sm font-medium text-muted-foreground">
            {fallback || getInitials(alt || '')}
          </span>
        </div>
      )}
    </div>
  );
}

interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  max?: number;
}

function AvatarGroup({ className, children, max = 5, ...props }: AvatarGroupProps) {
  const childArray = React.Children.toArray(children);
  const visibleChildren = childArray.slice(0, max);
  const remainingCount = childArray.length - max;

  return (
    <div className={cn('flex -space-x-2', className)} {...props}>
      {visibleChildren.map((child, index) =>
        React.cloneElement(child as React.ReactElement<any>, {
          className: cn('ring-2 ring-background', (child as React.ReactElement<any>).props.className),
          style: { zIndex: max - index },
        })
      )}
      {remainingCount > 0 && (
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted ring-2 ring-background')}>
          <span className="text-xs font-medium text-muted-foreground">+{remainingCount}</span>
        </div>
      )}
    </div>
  );
}

export { Avatar, AvatarGroup };