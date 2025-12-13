/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0a7ea4',
          hover: '#0969A4',
          light: '#38BDF8',
        },
      },
    },
  },
  plugins: [],
};
