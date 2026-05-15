/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './*.html',
    './js/**/*.js',
    './admin/**/*.html',
    './admin/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        sea: {
          50:  '#eaf2f9',
          100: '#cfdfee',
          200: '#9cc0dd',
          300: '#5d97c4',
          400: '#2f74a8',
          500: '#1a5e93',
          600: '#134c79',
          700: '#0d3a5f',
          800: '#0a2e4c',
          900: '#072136',
        },
        sun: {
          50:  '#fff8eb',
          100: '#fdedc6',
          200: '#fcd98a',
          300: '#f8c25a',
          400: '#f4b53d',
          500: '#e89812',
          600: '#c97c08',
          700: '#a35f06',
          800: '#7a4805',
          900: '#4e2f04',
        },
        coral: {
          500: '#e74c3c',
          600: '#c0392b',
        },
        ink: {
          700: '#1a3a5c',
          800: '#0a2e4c',
          900: '#061d33',
        },
      },
      fontFamily: {
        display: ['Montserrat', 'system-ui', 'sans-serif'],
        body:    ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(13,58,95,0.06), 0 8px 24px -8px rgba(13,58,95,0.18)',
        deep: '0 8px 32px -8px rgba(13,58,95,0.35)',
        glow: '0 0 0 4px rgba(232,152,18,0.18)',
      },
    },
  },
  plugins: [],
};
