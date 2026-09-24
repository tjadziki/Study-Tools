import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The iOS "inset grouped" list: an optional small-caps header, a rounded
 * plate of rows divided by hairlines that start where the text starts, and an
 * optional footnote. It is the shape of every Settings screen, and the most
 * recognisable thing in iOS.
 */
export function ListSection({ header, headerRight, footer, className, children, tone }) {
  return (
    <section className={cn('flex flex-col', className)}>
      {(header || headerRight) && (
        <div className="flex items-end justify-between gap-3 px-4 pb-1.5">
          <h3
            className={cn(
              'text-footnote font-medium uppercase tracking-wide',
              tone === 'orange' ? 'text-tint-orange' : 'text-muted-foreground'
            )}
          >
            {header}
          </h3>
          {headerRight && <div className="text-footnote text-muted-foreground tabular">{headerRight}</div>}
        </div>
      )}
      <div className="overflow-hidden rounded-xl bg-card">{children}</div>
      {footer && <p className="px-4 pt-1.5 text-footnote text-muted-foreground text-pretty">{footer}</p>}
    </section>
  );
}

/**
 * One row. Separators are drawn by each row above itself, inset to the text,
 * and never above the first row — exactly as UITableView does it.
 */
export const ListRow = React.forwardRef(
  ({ className, onClick, chevron = false, inset = 'pl-4', as: Comp, children, ...props }, ref) => {
    const Tag = Comp || (onClick ? 'button' : 'div');
    return (
      <Tag
        ref={ref}
        onClick={onClick}
        type={Tag === 'button' ? 'button' : undefined}
        className={cn(
          'relative flex w-full min-h-11 items-center gap-3 py-2.5 pr-4 text-left',
          inset,
          "[&:not(:first-child)]:before:absolute [&:not(:first-child)]:before:right-0 [&:not(:first-child)]:before:top-0 [&:not(:first-child)]:before:h-px [&:not(:first-child)]:before:bg-border [&:not(:first-child)]:before:content-['']",
          '[&:not(:first-child)]:before:left-[var(--sep-inset,1rem)]',
          onClick && 'transition-colors hover:bg-secondary/60 active:bg-secondary focus-visible:outline-none focus-visible:bg-secondary',
          className
        )}
        {...props}
      >
        {children}
        {chevron && <ChevronRight aria-hidden className="ml-auto size-4 shrink-0 text-label-3" strokeWidth={2.5} />}
      </Tag>
    );
  }
);
ListRow.displayName = 'ListRow';
