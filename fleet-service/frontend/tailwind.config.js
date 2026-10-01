/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        health: {
          green: '#22c55e',
          amber: '#f59e0b',
          orange: '#f97316',
          red: '#ef4444',
          bg: '#0f172a',
          card: '#1e293b'
        }
      }
    },
  },
  plugins: [],
}
