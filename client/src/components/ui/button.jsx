import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// shadcn/ui's Button, restyled after iOS 16's button roles:
//   default      filled — the one primary action on a surface
//   tinted       the "bordered" style: tinted text on a pale fill
//   gray         neutral secondary action
//   destructive  tinted red
//   plain        text-only, like a navigation-bar button
//   ghost        neutral text, for dense rows
const buttonVariants = cva(
  [
    'inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap font-semibold',
    'transition-[background-color,color,opacity,transform] duration-150 active:scale-[0.97]',
    'disabled:pointer-events-none disabled:opacity-40',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        tinted: 'bg-primary/15 text-tint-blue hover:bg-primary/20',
        gray: 'bg-secondary text-secondary-foreground hover:bg-fill',
        destructive: 'bg-destructive/15 text-tint-red hover:bg-destructive/20',
        orange: 'bg-ios-orange text-white hover:bg-ios-orange/90',
        plain: 'text-tint-blue hover:bg-primary/10',
        ghost: 'text-foreground hover:bg-secondary',
      },
      size: {
        default: 'h-9 rounded-[10px] px-3.5 text-subhead [&_svg]:size-4',
        sm: 'h-7 rounded-full px-3 text-footnote [&_svg]:size-3.5',
        lg: 'h-12 rounded-xl px-5 text-body [&_svg]:size-5',
        icon: 'size-9 rounded-full [&_svg]:size-[18px]',
        'icon-sm': 'size-7 rounded-full [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };
