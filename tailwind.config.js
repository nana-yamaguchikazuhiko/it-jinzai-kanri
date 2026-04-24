/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: '#06b6d4',
        sidebar: '#0f1c2e',
        bg: '#f0f4f8',
      },
    },
  },
  plugins: [],
}
