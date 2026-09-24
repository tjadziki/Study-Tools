import path from 'node:path';
import { fileURLToPath } from 'node:url';
import animate from 'tailwindcss-animate';

const here = path.dirname(fileURLToPath(import.meta.url));

// Every colour is a CSS variable holding bare HSL channels, so Tailwind's
// opacity modifiers work on all of them (bg-primary/15 is how the iOS "tinted"
// button is made) and the whole palette swaps for dark mode in one place:
// src/deck.css.
const v = (name) => `hsl(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  // Follow the OS, the way an iOS app does.
  darkMode: 'media',
  // Absolute, because vite is launched from the repo root and relative globs
  // would resolve against the wrong directory. The phone app shares the ui/
  // components, so its sources are scanned too.
  content: [
    path.join(here, 'index.html'),
    path.join(here, 'src/**/*.{js,jsx}'),
    path.join(here, 'phone/**/*.{html,js,jsx}'),
  ],
  theme: {
    extend: {
      colors: {
        border: v('border'),
        input: v('input'),
        ring: v('ring'),
        background: v('background'),
        foreground: v('foreground'),
        primary: { DEFAULT: v('primary'), foreground: v('primary-foreground') },
        secondary: { DEFAULT: v('secondary'), foreground: v('secondary-foreground') },
        destructive: { DEFAULT: v('destructive'), foreground: v('destructive-foreground') },
        muted: { DEFAULT: v('muted'), foreground: v('muted-foreground') },
        accent: { DEFAULT: v('accent'), foreground: v('accent-foreground') },
        popover: { DEFAULT: v('popover'), foreground: v('popover-foreground') },
        card: { DEFAULT: v('card'), foreground: v('card-foreground') },
        // iOS system colours, for fills and solid badges.
        ios: {
          blue: v('primary'),
          orange: v('orange'),
          red: v('red'),
          green: v('green'),
          yellow: v('yellow'),
          indigo: v('indigo'),
          teal: v('teal'),
          purple: v('purple'),
        },
        // The same hues darkened for text in light mode — iOS orange on white
        // is under 2.5:1, which is fine for a fill and unreadable as a label.
        tint: {
          blue: v('blue-ink'),
          orange: v('orange-ink'),
          red: v('red-ink'),
          green: v('green-ink'),
          indigo: v('indigo-ink'),
          teal: v('teal-ink'),
          purple: v('purple-ink'),
        },
        chart: { calm: v('chart-calm'), busy: v('chart-busy'), heavy: v('chart-heavy') },
        fill: v('fill'),
        elevated: v('elevated'),
        'label-3': v('label-3'),
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 6px)',
        xl: 'calc(var(--radius) + 2px)',
        '2xl': 'calc(var(--radius) + 6px)',
        '3xl': 'calc(var(--radius) + 12px)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"Segoe UI Variable Text"',
          '"Segoe UI"',
          'system-ui',
          'sans-serif',
        ],
        display: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"Segoe UI Variable Display"',
          '"Segoe UI"',
          'system-ui',
          'sans-serif',
        ],
        mono: ['ui-monospace', '"SF Mono"', '"Cascadia Code"', 'Consolas', 'monospace'],
      },
      // The iOS Dynamic Type scale, at its default size.
      fontSize: {
        'large-title': ['2.125rem', { lineHeight: '2.5625rem', letterSpacing: '0.012em' }],
        'title-1': ['1.75rem', { lineHeight: '2.125rem', letterSpacing: '0.013em' }],
        'title-2': ['1.375rem', { lineHeight: '1.75rem', letterSpacing: '0.016em' }],
        'title-3': ['1.25rem', { lineHeight: '1.5625rem', letterSpacing: '0.019em' }],
        headline: ['1.0625rem', { lineHeight: '1.375rem', letterSpacing: '-0.026em' }],
        body: ['1.0625rem', { lineHeight: '1.375rem', letterSpacing: '-0.026em' }],
        callout: ['1rem', { lineHeight: '1.3125rem', letterSpacing: '-0.02em' }],
        subhead: ['0.9375rem', { lineHeight: '1.25rem', letterSpacing: '-0.015em' }],
        footnote: ['0.8125rem', { lineHeight: '1.125rem', letterSpacing: '-0.005em' }],
        caption: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0' }],
        'caption-2': ['0.6875rem', { lineHeight: '0.8125rem', letterSpacing: '0.006em' }],
      },
      keyframes: {
        blip: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.35' } },
      },
      animation: {
        blip: 'blip 1.1s ease-in-out infinite',
      },
    },
  },
  plugins: [animate],
};
