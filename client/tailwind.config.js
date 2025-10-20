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
            500: '#4169e1', // Royal Blue (light mode)
            600: '#3759c2',
            700: '#1e3a8a', // Dark Royal Blue (dark mode primary)
            800: '#1e40af',
            900: '#1e3a8a',
            950: '#0f1f47',
          },
          secondary: {
            50: '#fafafa',
            100: '#f5f5f5',
            200: '#e5e5e5',
            300: '#d4d4d4',
            400: '#a3a3a3',
            500: '#737373',
            600: '#525252',
            700: '#404040',
            800: '#262626',
            900: '#171717',
            950: '#0a0a0a',
          },
          gold: {
            50: '#fffef7',
            100: '#fffaeb',
            200: '#fff4d1',
            300: '#ffe99d',
            400: '#ffd95a',
            500: '#ffc107', // Shiny Gold
            600: '#f59e0b',
            700: '#d97706',
            800: '#b45309',
            900: '#92400e',
            950: '#78350f',
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