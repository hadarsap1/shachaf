/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Shahaf School brand colors — extracted from official logo
        brand: {
          navy:   '#1B3B70',
          teal:   '#2BA888',
          orange: '#F09530',
          lime:   '#C5D33A',
          red:    '#D94E1F',
        },
        primary: {
          DEFAULT: '#1B3B70',
          50:  '#EBF0F9',
          100: '#C7D4EE',
          200: '#93A9DC',
          300: '#607EC9',
          400: '#3459B0',
          500: '#1B3B70',
          600: '#163060',
          700: '#102449',
          800: '#0B1831',
          900: '#050C18',
        },
        secondary: {
          DEFAULT: '#2BA888',
          50:  '#E5F6F1',
          100: '#B8E8D9',
          200: '#7DD4BC',
          300: '#4DC0A1',
          400: '#2BA888',
          500: '#22886D',
          600: '#1A6853',
          700: '#124839',
          800: '#0B2C22',
          900: '#041410',
        },
        accent: {
          DEFAULT: '#F09530',
          50:  '#FEF3E5',
          100: '#FDE0B5',
          200: '#FAC474',
          300: '#F7A943',
          400: '#F09530',
          500: '#D07A18',
          600: '#A45E11',
          700: '#7A450B',
          800: '#502D06',
          900: '#281602',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        hebrew: ['Heebo', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(27,59,112,0.06), 0 4px 12px rgba(27,59,112,0.10)',
        'card-hover': '0 4px 6px rgba(27,59,112,0.08), 0 8px 24px rgba(27,59,112,0.18)',
        'modal': '0 20px 60px rgba(0,0,0,0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-dot': 'pulseDot 2s infinite',
        'slide-from-right': 'slideFromRight 0.25s ease-out',
        'check-done': 'checkDone 0.6s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseDot: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.4)', opacity: '0.7' },
        },
        slideFromRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        checkDone: {
          '0%':   { transform: 'scale(1)' },
          '30%':  { transform: 'scale(1.4)' },
          '60%':  { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}

