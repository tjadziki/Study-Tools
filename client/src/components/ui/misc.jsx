import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONE_BG = {
  blue: 'bg-primary',
  orange: 'bg-ios-orange',
  green: 'bg-ios-green',
  red: 'bg-ios-red',
  gray: 'bg-muted-foreground',
  indigo: 'bg-ios-indigo',
};

/** A thin rounded bar. `value` is 0–100. */
export function Progress({ value = 0, tone = 'blue', className, trackClassName }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-fill', trackClassName, className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-300', TONE_BG[tone] || TONE_BG.blue)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/**
 * The round checkmark iOS uses in Reminders: an empty ring, or a filled disc
 * with a tick. A real checkbox for assistive tech.
 */
export function CheckCircle({ checked, onClick, label, tone = 'blue', className, size = 'default', decorative = false }) {
  const dim = size === 'sm' ? 'size-5' : 'size-[22px]';
  const mark = checked ? (
    <span className={cn('grid place-items-center rounded-full text-white', dim, TONE_BG[tone] || TONE_BG.blue)}>
      <Check className="size-3.5" strokeWidth={3.5} />
    </span>
  ) : (
    <span className={cn('rounded-full border-[1.5px] border-label-3', dim)} />
  );
  // Inside a row that is itself the button, a second button would be invalid
  // HTML; the row carries the semantics and this is only the picture.
  if (decorative) {
    return (
      <span aria-hidden className={cn('grid shrink-0 place-items-center', className)}>
        {mark}
      </span>
    );
  }
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={!!checked}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'grid shrink-0 place-items-center rounded-full transition-transform active:scale-90',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
        className
      )}
    >
      {mark}
    </button>
  );
}

/** A labelled number: small caps label over a large tabular figure. */
export function Stat({ label, value, sub, tone, className, size = 'default' }) {
  const color =
    tone === 'orange'
      ? 'text-tint-orange'
      : tone === 'blue'
        ? 'text-tint-blue'
        : tone === 'green'
          ? 'text-tint-green'
          : tone === 'red'
            ? 'text-tint-red'
            : 'text-foreground';
  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <div className="text-caption font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          'font-display font-semibold tabular',
          size === 'lg' ? 'text-large-title' : size === 'sm' ? 'text-headline' : 'text-title-2',
          color
        )}
      >
        {value}
      </div>
      {sub && <div className="text-footnote text-muted-foreground tabular">{sub}</div>}
    </div>
  );
}

/** A keyboard key. */
export function Kbd({ className, children }) {
  return (
    <kbd
      className={cn(
        'inline-grid h-5 min-w-5 place-items-center rounded-md border border-border bg-card px-1 font-sans text-caption-2 font-semibold text-muted-foreground shadow-[0_1px_0_hsl(var(--border))]',
        className
      )}
    >
      {children}
    </kbd>
  );
}

/** A tinted panel with a message — for the few things on a screen that need one. */
export function Callout({ tone = 'blue', title, children, className, icon: Icon }) {
  const ring = {
    blue: 'bg-primary/10 text-tint-blue',
    orange: 'bg-ios-orange/15 text-tint-orange',
    red: 'bg-ios-red/10 text-tint-red',
    green: 'bg-ios-green/15 text-tint-green',
    gray: 'bg-secondary text-muted-foreground',
  }[tone];
  return (
    <div className={cn('flex gap-3 rounded-xl p-3.5', ring, className)}>
      {Icon && <Icon aria-hidden className="mt-0.5 size-[18px] shrink-0" />}
      <div className="min-w-0 flex-1">
        {title && <div className="text-subhead font-semibold">{title}</div>}
        <div className={cn('text-footnote text-foreground/80 text-pretty', title && 'mt-0.5')}>{children}</div>
      </div>
    </div>
  );
}

/** The iOS switch. */
export function Switch({ on, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={cn(
        'relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
        on ? 'bg-ios-green' : 'bg-fill'
      )}
    >
      <span
        className={cn(
          'absolute left-[2px] size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] transition-transform duration-200',
          on && 'translate-x-5'
        )}
      />
    </button>
  );
}
