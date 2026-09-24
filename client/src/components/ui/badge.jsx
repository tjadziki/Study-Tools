import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// shadcn/ui's Badge as an iOS capsule. Tinted by default — colour at 15% on
// the fill, the full hue (darkened in light mode) on the text — with solid
// versions for the one thing on a screen that must be seen first.
const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-caption font-semibold [&_svg]:size-3',
  {
    variants: {
      tone: {
        gray: 'bg-secondary text-muted-foreground',
        blue: 'bg-primary/15 text-tint-blue',
        orange: 'bg-ios-orange/15 text-tint-orange',
        red: 'bg-ios-red/15 text-tint-red',
        green: 'bg-ios-green/15 text-tint-green',
        indigo: 'bg-ios-indigo/15 text-tint-indigo',
        teal: 'bg-ios-teal/15 text-tint-teal',
        purple: 'bg-ios-purple/15 text-tint-purple',
        'solid-orange': 'bg-ios-orange text-white',
        'solid-blue': 'bg-primary text-primary-foreground',
        'solid-red': 'bg-ios-red text-white',
        outline: 'border border-border text-muted-foreground',
      },
    },
    defaultVariants: { tone: 'gray' },
  }
);

function Badge({ className, tone, ...props }) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { Badge, badgeVariants };
