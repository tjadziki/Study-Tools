import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge only knows Tailwind's built-in font sizes. Left alone it
// would read `text-footnote` as a colour, and quietly drop
// `text-muted-foreground` from the same element as a "conflict". Registering
// the iOS type scale keeps sizes and colours in their own groups.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'large-title',
            'title-1',
            'title-2',
            'title-3',
            'headline',
            'body',
            'callout',
            'subhead',
            'footnote',
            'caption',
            'caption-2',
          ],
        },
      ],
    },
  },
});

/** Join class names, letting later Tailwind utilities override earlier ones. */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
