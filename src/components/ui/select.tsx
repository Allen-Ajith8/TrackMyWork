'use client';

import * as React from 'react';
import * as SelectPrimitives from '@radix-ui/react-select';
import { cn } from '@/lib/utils';

const Select = SelectPrimitives.Root as unknown as React.ComponentType<any>;
const SelectGroup = SelectPrimitives.Group;
const SelectValue = SelectPrimitives.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitives.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitives.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitives.Trigger
    ref={ref}
    className={cn(
      'flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:truncate',
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitives.Icon asChild>
      <svg
        className="h-4 w-4 shrink-0 opacity-50"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M7.5 10.5L3.5 6.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M11.5 6.5L7.5 10.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </SelectPrimitives.Icon>
  </SelectPrimitives.Trigger>
));
SelectTrigger.displayName = SelectPrimitives.Trigger.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitives.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitives.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitives.Portal>
    <SelectPrimitives.Content
      ref={ref}
      className={cn(
        'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        position === 'popper' &&
          'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitives.Viewport
        className={cn(
          'p-1',
          position === 'popper' &&
            'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]'
        )}
      >
        {children}
      </SelectPrimitives.Viewport>
    </SelectPrimitives.Content>
  </SelectPrimitives.Portal>
));
SelectContent.displayName = SelectPrimitives.Content.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitives.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitives.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitives.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitives.ItemIndicator>
        <svg
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
        </svg>
      </SelectPrimitives.ItemIndicator>
    </span>
    <SelectPrimitives.ItemText>{children}</SelectPrimitives.ItemText>
  </SelectPrimitives.Item>
));
SelectItem.displayName = SelectPrimitives.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitives.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitives.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitives.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-muted', className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitives.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectSeparator,
};