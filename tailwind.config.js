/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // Include all your source files
    "./public/index.html"         // Include the public HTML file
  ],
  theme: {
    extend: {}, // Extend Tailwind's default theme if needed
  },
  plugins: [],
};
