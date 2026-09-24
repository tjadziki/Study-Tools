import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// iOS text fields are filled, not outlined: a pale gray plate that takes a
// blue focus ring. Input, Textarea and the native Select share that look.

const field = [
  'w-full rounded-[10px] border-0 bg-secondary px-3 text-subhead text-foreground',
  'placeholder:text-muted-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  'disabled:cursor-not-allowed disabled:opacity-50',
];

const Input = React.forwardRef(({ className, type = 'text', ...props }, ref) => (
  <input ref={ref} type={type} className={cn(field, 'h-9 tabular', className)} {...props} />
));
Input.displayName = 'Input';

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(field, 'min-h-[84px] resize-y py-2.5 leading-snug', className)} {...props} />
));
Textarea.displayName = 'Textarea';

/**
 * A native <select> dressed as an iOS field. Native on purpose: it is the
 * control every platform already knows how to operate, keyboard included.
 */
const NativeSelect = React.forwardRef(({ className, wrapperClassName, children, ...props }, ref) => (
  <span className={cn('relative block', wrapperClassName)}>
    <select ref={ref} className={cn(field, 'h-9 cursor-pointer appearance-none pr-8', className)} {...props}>
      {children}
    </select>
    <ChevronDown
      aria-hidden
      className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
    />
  </span>
));
NativeSelect.displayName = 'NativeSelect';

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <label ref={ref} className={cn('text-footnote font-medium text-muted-foreground', className)} {...props} />
));
Label.displayName = 'Label';

/** A label stacked over its control. */
function Field({ label, htmlFor, className, children }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

/** The Input look, for inputs that are not <Input> (CommitInput). */
const inputClass = cn(field, 'h-9 tabular');

export { Input, Textarea, NativeSelect, Label, Field, inputClass };
