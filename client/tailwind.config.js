/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fdf0fd',
          100: '#f9d4fa',
          200: '#f3a5f4',
          300: '#e968ea',
          400: '#d234d4',
          500: '#8f0d90',
          600: '#580259',
          700: '#450148',
          800: '#320036',
          900: '#1f0020',
        },
      },
    },
  },
  plugins: [],
};
