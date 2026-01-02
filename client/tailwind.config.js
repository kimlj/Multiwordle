/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'wordle-green': '#6aaa64',
        'wordle-yellow': '#c9b458',
        'wordle-gray': '#787c7e',
        'wordle-dark': '#121213',
        'wordle-tile': '#3a3a3c',
        'wordle-border': '#565758',
      },
      fontFamily: {
        'display': ['Clash Display', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'flip': 'flip 0.5s ease forwards',
        'pop': 'pop 0.1s ease-out',
        'shake': 'shake 0.5s ease-in-out',
        'bounce-in': 'bounceIn 0.5s ease-out',
        'pulse-glow': 'pulseGlow 2s infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'wiggle': 'wiggle 0.3s ease-in-out',
        'nudge-pulse': 'nudgePulse 0.5s ease-in-out infinite',
      },
      keyframes: {
        flip: {
          '0%': { transform: 'rotateX(0deg)' },
          '50%': { transform: 'rotateX(-90deg)' },
          '100%': { transform: 'rotateX(0deg)' },
        },
        pop: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-5px)' },
          '40%, 80%': { transform: 'translateX(5px)' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(106, 170, 100, 0.5)' },
          '50%': { boxShadow: '0 0 40px rgba(106, 170, 100, 0.8)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-10deg)' },
          '50%': { transform: 'rotate(10deg)' },
          '75%': { transform: 'rotate(-5deg)' },
        },
        nudgePulse: {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(201, 180, 88, 0.4)' },
          '50%': { transform: 'scale(1.02)', boxShadow: '0 0 20px 5px rgba(201, 180, 88, 0.6)' },
        },
      },
    },
  },
  plugins: [],
}
