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
          DEFAULT: 'hsl(var(--dark))',
          ink: 'hsl(var(--dark))',
        },
        moss: {
          DEFAULT: 'hsl(var(--secondary-hue))',
          bright: 'hsl(var(--secondary-hue))',
          deep: 'hsl(var(--secondary-ink))',
        },
        sand: 'hsl(var(--light))',
        sunset: {
          DEFAULT: 'hsl(var(--tertiary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        tertiary: {
          DEFAULT: 'hsl(var(--tertiary))',
          ink: 'hsl(var(--tertiary-ink))',
        },

        /* National Park surface system — see styles/np-surfaces.css. */
        np: {
          ground: 'hsl(var(--np-ground) / <alpha-value>)',
          surface: 'hsl(var(--np-surface) / <alpha-value>)',
          card: 'hsl(var(--np-card) / <alpha-value>)',
          raised: 'hsl(var(--np-raised) / <alpha-value>)',
          hover: 'hsl(var(--np-hover) / <alpha-value>)',
          well: 'hsl(var(--np-well) / <alpha-value>)',
          canopy: 'hsl(var(--np-canopy) / <alpha-value>)',
          sage: 'hsl(var(--np-sage) / <alpha-value>)',
          moss: 'hsl(var(--np-moss) / <alpha-value>)',
          teal: 'hsl(var(--np-teal) / <alpha-value>)',
          cream: 'hsl(var(--np-cream) / <alpha-value>)',
          body: 'hsl(var(--np-body) / <alpha-value>)',
          meta: 'hsl(var(--np-meta) / <alpha-value>)',
          beige: 'hsl(var(--np-beige) / <alpha-value>)',
          social: 'hsl(var(--np-social) / <alpha-value>)',
          ink: 'hsl(var(--np-on-accent) / <alpha-value>)',
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
      /* design.md: sm 2 / md 4 / lg 6 — signage corners. The larger Tailwind
         steps are pulled in too, so existing `rounded-2xl` cards follow. */
      borderRadius: {
        '3xl': '8px',
        '2xl': '6px',
        xl: '6px',
        lg: '6px',
        md: 'var(--radius)',
        sm: '2px',
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
