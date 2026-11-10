/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pvpsit: {
          blue: '#005BAC',
          dark: '#0F172A',
          accent: '#2563EB',
          success: '#16A34A',
          warning: '#F59E0B',
          danger: '#DC2626',
          bg: '#F8FAFC',
          card: '#FFFFFF',
          border: '#E2E8F0'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'lg': '10px',  // rounded corners for buttons/inputs
        'xl': '12px',  // rounded corners for cards
        '2xl': '16px'
      }
    },
  },
  plugins: [],
}
