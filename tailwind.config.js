/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: '#29e6d3',
        sidebar: '#262526',
        bg: '#F5F4F0',
      },
    },
  },
  plugins: [],
}
