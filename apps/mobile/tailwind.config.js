/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0a7ea4',
          hover: '#0969A4',
          light: '#38BDF8',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#1E2022',
        },
        background: {
          light: '#FFFFFF',
          dark: '#151718',
          secondary: {
            light: '#F5F5F5',
            dark: '#1E2022',
          },
        },
        border: {
          light: '#E5E7EB',
          dark: '#2E3336',
        },
        text: {
          light: '#11181C',
          dark: '#ECEDEE',
          secondary: {
            light: '#687076',
            dark: '#9BA1A6',
          },
          muted: {
            light: '#9BA1A6',
            dark: '#687076',
          },
        },
        user: {
          bubble: '#0a7ea4',
        },
        assistant: {
          bubble: {
            light: '#F5F5F5',
            dark: '#262A2C',
          },
        },
      },
    },
  },
  plugins: [],
};
