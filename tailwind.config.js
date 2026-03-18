/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: '#1CC29F',
          light: '#e6f9f4',
          dark: '#15a085',
        },
        charcoal: {
          DEFAULT: '#2d3436',
          light: '#636e72',
        },
        danger: {
          DEFAULT: '#e74c3c',
          light: '#fde8e6',
        },
      },
    },
  },
  plugins: [],
}
