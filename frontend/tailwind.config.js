/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Cabinet Grotesk"', '"DM Sans"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        surface: {
          950: '#06080F',
          900: '#0B0E18',
          800: '#111520',
          700: '#181D2E',
          600: '#212840',
          500: '#2D3655',
        },
        neon: {
          DEFAULT: '#00FFB2',
          dim: '#00CC8E',
          muted: 'rgba(0,255,178,0.15)',
          glow: 'rgba(0,255,178,0.06)',
        },
        ember: {
          DEFAULT: '#FF6B35',
          dim: '#CC5529',
          muted: 'rgba(255,107,53,0.15)',
        },
        ice: {
          DEFAULT: '#7DD3FC',
          dim: '#38BDF8',
          muted: 'rgba(125,211,252,0.15)',
        },
        danger: {
          DEFAULT: '#FF4D6D',
          muted: 'rgba(255,77,109,0.15)',
        },
      },
      backgroundImage: {
        'dot-grid': 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
        'scan-lines': 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,178,0.015) 2px, rgba(0,255,178,0.015) 4px)',
      },
      backgroundSize: {
        'dot-grid': '28px 28px',
      },
      keyframes: {
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.94)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'bar': {
          '0%,100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.45s cubic-bezier(0.16,1,0.3,1) forwards',
        'slide-in': 'slide-in 0.35s cubic-bezier(0.16,1,0.3,1) forwards',
        'fade-in': 'fade-in 0.3s ease forwards',
        'scale-in': 'scale-in 0.35s cubic-bezier(0.16,1,0.3,1) forwards',
        'bar': 'bar 1.1s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 1.5s ease-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'spin-slow': 'spin-slow 3s linear infinite',
      },
    },
  },
  plugins: [],
}