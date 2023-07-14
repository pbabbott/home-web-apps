const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(
      __dirname,
      '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}'
    ),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {
      colors: {
        "primary": {
          50: "#EDFFFE",
          300: "#3AFCFF",
          500: "#00E2E0",
          700: "#008E91",
          900: "#04595D",
        },
        "secondary": {
          50: "#EFFBFF",
          300: "#71E9FF",
          500: "#00CCFE",
          700: "#0083B0",
          900: "#025C78",
        },
        "purple": {
          50: "#f2f0ff",
          300: "#B6A5FF",
          500: "#723aff",
          700: "#5501ff",
          900: "#3C02B0",
        },
        "falcon": {
          50: "#f9f6f9",
          300: "#d8c9d4",
          500: "#aa8aa0",
          700: "#805e73",
          900: "#58434f",
        },
        "success": {
          50: "#f1f8f4",
          300: "#92c3aa",
          500: "#428767",
          700: "#265642",
          900: "#1b392d",
        },
        "warning": {
          50: "#fff9eb",
          300: "#ffbf46",
          500: "#f98407",
          700: "#b73f06",
          900: "#7a290d",
        },
        "error": {
          50: "#fdf3f3",
          300: "#f0b1b1",
          500: "#da595e",
          700: "#a62a38",
          900: "#772432",
        },
      }
    },
  },
  plugins: [],
};