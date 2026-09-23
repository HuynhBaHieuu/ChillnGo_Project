import tailwindcssAnimate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        sans: ['var(--font-body)'],
      },
      colors: {
        /* Brand palette, for the few places that want a specific colour
           rather than a semantic role. Old names are aliased so existing call
           sites keep compiling: `forest` is now the ink, `sand` the ground,
           `sunset` the pink accent. */
        forest: {
          DEFAULT: 'hsl(var(--primary-hue))',
          ink: 'hsl(var(--primary-hue))',
        },
        moss: {
          DEFAULT: 'hsl(var(--secondary-hue))',
          bright: 'hsl(var(--secondary-hue))',
          deep: 'hsl(var(--secondary-ink))',
        },
        sand: 'hsl(var(--neutral))',
        sunset: {
          DEFAULT: 'hsl(var(--tertiary))',
          foreground: 'hsl(var(--primary-hue))',
        },
        tertiary: {
          DEFAULT: 'hsl(var(--tertiary))',
          ink: 'hsl(var(--tertiary-ink))',
        },

        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        paper: 'hsl(var(--paper))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      /* design.md: sm 10 / md 18 / lg 28 — squishy on purpose. */
      borderRadius: {
        lg: '28px',
        md: 'var(--radius)',
        sm: '10px',
      },
      maxWidth: {
        '7xl': '80rem',
      },
      keyframes: {
        'fade-rise': {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'fade-rise': 'fade-rise 0.8s ease-out both',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
