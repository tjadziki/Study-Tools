import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// shadcn/ui's Dialog on Radix, shaped like an iOS sheet: a large-radius card
// over a dimmed, blurred page. Radix supplies the focus trap, Escape to close
// and the scroll lock.

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]',
      'data-[state=open]:animate-in data-[state=open]:fade-in-0',
      'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef(({ className, children, hideClose = false, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-[7vh] z-50 flex max-h-[86vh] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-4 overflow-y-auto',
        'rounded-3xl bg-card p-6 text-card-foreground shadow-2xl shadow-black/20 focus:outline-none',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97] data-[state=open]:slide-in-from-top-2',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.97]',
        className
      )}
      {...props}
    >
      {children}
      {!hideClose && (
        <DialogPrimitive.Close
          className="absolute right-4 top-4 grid size-7 place-items-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-fill hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close"
        >
          <X className="size-4" strokeWidth={2.5} />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

function DialogHeader({ className, ...props }) {
  return <div className={cn('flex flex-col gap-1 pr-8', className)} {...props} />;
}

function DialogFooter({ className, ...props }) {
  return <div className={cn('flex flex-wrap justify-end gap-2 pt-1', className)} {...props} />;
}

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-title-3 font-semibold text-balance', className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-subhead text-muted-foreground text-pretty', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

/** The small caps line above a dialog title — "STUCK TIMER · 25 MIN". */
function DialogEyebrow({ className, tone = 'muted', ...props }) {
  return (
    <div
      className={cn(
        'text-caption font-semibold uppercase tracking-wide',
        tone === 'orange' ? 'text-tint-orange' : tone === 'blue' ? 'text-tint-blue' : 'text-muted-foreground',
        className
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogEyebrow,
};
