/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      // Font family
      fontFamily: {
        body: [
          "'Inter'",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        display: [
          "'Newsreader'",
          "serif",
        ],
        devanagari: [
          "'Tiro Devanagari Hindi'",
          "serif",
        ],
        code: [
          "'JetBrains Mono'",
          "monospace",
        ],
        spectral: [
          "'Spectral'",
          "serif",
        ],
        instrument: [
          "'Instrument Serif'",
          "serif",
        ],
        geist: [
          "'Geist'",
          "sans-serif",
        ],
      },
      // Spacing scale (4-base)
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        6: '24px',
        8: '32px',
        12: '48px',
        16: '64px',
      },
      // Typography scale
      fontSize: {
        xs: ['12px', { lineHeight: '1.4' }],
        sm: ['13px', { lineHeight: '1.4' }],
        base: ['14px', { lineHeight: '1.4' }],
        md: ['16px', { lineHeight: '1.4' }],
        lg: ['18px', { lineHeight: '1.4' }],
        xl: ['20px', { lineHeight: '1.4' }],
        '2xl': ['24px', { lineHeight: '1.4' }],
        '3xl': ['32px', { lineHeight: '1.4' }],
        '4xl': ['40px', { lineHeight: '1.4' }],
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
      lineHeight: {
        tight: '1.2',
        body: '1.4',
        button: '1.0',
      },
      // Colors: Design system tokens
      colors: {
        // Accent
        accent: {
          DEFAULT: '#1AB8B0',
          hover: '#17a39c',
          pressed: '#148f88',
          subtle: '#e8faf9',
        },
        // Background
        bgDefault: '#F6F3EC', /* warm paper/cream */
        bgSubtle: '#f8f9fb',
        bgMuted: '#f1f3f7',
        bgElevated: '#FCFAF5', /* slightly elevated cards */
        bgOverlay: 'rgba(0,0,0,0.04)',
        // Border
        borderDefault: '#e2e6ed',
        borderSubtle: '#eef0f4',
        borderStrong: '#bcc4d0',
        // Text
        textDefault: '#111827',
        textMuted: '#6b7280',
        textSubtle: '#9ca3af',
        textDisabled: '#d1d5db',
        textOnAccent: '#ffffff',
        // Semantic colors
        success: '#16a34a',
        successBg: '#f0fdf4',
        warning: '#d97706',
        warningBg: '#fffbeb',
        danger: '#dc2626',
        dangerBg: '#fef2f2',
        info: '#2563eb',
        infoBg: '#eff6ff',
      },
      // Shadow
      shadow: {
        sm: '0 1px 2px rgba(0,0,0,0.06)',
        md: '0 4px 12px rgba(0,0,0,0.08)',
        lg: '0 8px 24px rgba(0,0,0,0.10)',
      },
      // Border radius
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        full: '9999px',
      },
    },
  },
  darkMode: 'class', // enable dark mode via class
  plugins: [],
};