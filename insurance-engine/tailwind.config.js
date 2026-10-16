/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          800: "#0f172a",
          900: "#090e1a",
          950: "#040711",
        },
      },
    },
  },
  plugins: [],
};
