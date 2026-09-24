import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * iOS's segmented control: a gray track with a raised white thumb on the
 * selected option. Keyboard: arrow keys move the selection, as a tablist does.
 */
export function Segmented({ value, onChange, options, className, size = 'default', ariaLabel }) {
  const refs = React.useRef([]);
  const idx = options.findIndex((o) => o.value === value);

  const onKeyDown = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const step = e.key === 'ArrowRight' ? 1 : -1;
    const next = (idx + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn('inline-flex rounded-[9px] bg-fill p-0.5', className)}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => (refs.current[i] = el)}
            role="tab"
            type="button"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] font-semibold transition-[background-color,color,box-shadow] duration-150',
              size === 'sm' ? 'h-6 px-2.5 text-caption' : 'h-7 px-3 text-footnote',
              on
                ? 'bg-elevated text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.04)]'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {o.label}
            {o.badge != null && (
              <span className="rounded-full bg-ios-orange px-1.5 text-caption-2 font-bold leading-4 text-white tabular">
                {o.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
