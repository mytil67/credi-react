/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palette inspirée de votre existant mais modernisée
        primary: '#2563eb',    // Bleu roi
        secondary: '#475569',  // Gris ardoise
        background: '#f1f5f9', // Gris très clair pour le fond
        surface: '#ffffff',    // Blanc pur
      }
    },
  },
  plugins: [],
}