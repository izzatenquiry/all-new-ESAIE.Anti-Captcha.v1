/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          start: '#F97316', // Bright Orange
          end: '#EAB308',   // Vibrant Yellow
        },
        primary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#F97316', // Brand Orange
          500: '#ea580c',
          600: '#EAB308', // Brand Yellow (using as 600 for gradient mapping)
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        neutral: {
          50: '#F9FAFB', // Very light grey
          100: '#F7F7F7', // Section bg
          200: '#E5E5E5', // Divider
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1A1A1A', // Dark typography
          900: '#111111', // Headings
        },
      },
      boxShadow: {
        'soft': '0 4px 24px rgba(0, 0, 0, 0.06)',
        'hover': '0 8px 30px rgba(0, 0, 0, 0.08)',
        'glow': '0 0 20px rgba(249, 115, 22, 0.25)',
        'inner-light': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      keyframes: {
        zoomIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        reverseSpin: {
          'from': { transform: 'rotate(360deg)' },
          'to': { transform: 'rotate(0deg)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        }
      },
      animation: {
        zoomIn: 'zoomIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'reverse-spin': 'reverseSpin 1s linear infinite',
        marquee: 'marquee 50s linear infinite',
      },
      transitionTimingFunction: {
        'custom-ease': 'cubic-bezier(0.16, 1, 0.3, 1)',
      }
    },
  },
  plugins: [],
};
