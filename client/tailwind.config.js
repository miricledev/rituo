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
          primary: {
            50: '#eaf0fb',
            100: '#d4e1f7',
            200: '#a9c3ef',
            300: '#7ea5e7',
            400: '#5387df',
            500: '#4169e1', // Royal Blue
            600: '#3759c2',
            700: '#2d499e',
            800: '#22387a',
            900: '#182856',
            950: '#0d1430',
          },
          secondary: {
            50: '#fffbea', // light gold
            100: '#fff6d1',
            200: '#ffec9e',
            300: '#ffe16b',
            400: '#ffd738',
            500: '#FFD700', // Shiny Gold
            600: '#e6be00',
            700: '#b39700',
            800: '#806f00',
            900: '#4d4700',
            950: '#262300',
          },
          success: {
            50: '#f0fdf4',
            100: '#dcfce7',
            200: '#bbf7d0',
            300: '#86efac',
            400: '#4ade80',
            500: '#22c55e',
            600: '#16a34a',
            700: '#15803d',
            800: '#166534',
            900: '#14532d',
            950: '#052e16',
          },
        },
        fontFamily: {
          sans: ['Inter', 'sans-serif'],
          display: ['Montserrat', 'sans-serif'],
        },
        animation: {
          'bounce-slow': 'bounce 3s infinite',
          'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        },
        boxShadow: {
          'task': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          'card': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        },
      },
    },
    plugins: [],
  }