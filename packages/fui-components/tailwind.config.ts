import type { Config } from "tailwindcss";

//  https://tailwindcss.com/docs/customizing-colors

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./.storybook/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ["class", '[data-mode="dark"]'],
  theme: {
    fontSize: {
      'h1': ['3rem', { lineHeight: '1' }], // 48px
      'h2': ['2.125rem', { lineHeight: '1' }], // 34px
      'h3': ['4.25rem', { lineHeight: '.7' }], // 68px
      'h4': ['3.5rem', { lineHeight: '.8' }], // 56px
      'h5': ['2.5rem', { lineHeight: '.8' }], // 40px
      'h6': ['2.25rem', { lineHeight: '.8' }], // 36px
      'body1': ['2rem', { lineHeight: '.8' }], // 32px
      'body2': ['1.75rem', { lineHeight: '.8' }], // 28px
      'button': ['1.75rem', { lineHeight: '.8' }], // 28px
      'caption': ['1.125rem', { lineHeight: '.8' }], // 18px
      'small': ['1rem', { lineHeight: '.8' }], // 16px
    },
    extend: {
      fontFamily: {
        'monobit': ['monobit', 'sans-serif'],
        'ethnocentric': ['ethnocentric', 'serif'],
      },
      colors: {
        neutral: {
          50: "#F8F8F8",
          100: "#F2FCFF",
          200: "#DFEDF2",
          300: "#C8D9DE",
          400: "#ADD2DE",
          500: "#8DABB5",
          600: "#728A92",
          700: "#3D4A4F",
          800: "#2E373B",
          900: "#23272B",
          1000: "#171819",
        },
        primary: {
          DEFAULT: "#008E91",
          50: "#F2FFFF",
          100: "#DDFEFF",
          200: "#B4FEFF",
          300: "#8CFDFF",
          400: "#63FDFF",
          500: "#3AFCFF",
          600: "#02FBFF",
          700: "#00C6C9",
          800: "#008E91",
          900: "#005759",
          950: "#003C3D",
        },
        secondary: {
          DEFAULT: "#03BEFF",
          50: "#BAEDFF",
          100: "#A6E8FF",
          200: "#7DDEFF",
          300: "#54D3FF",
          400: "#2BC9FF",
          500: "#03BEFF",
          600: "#00A1D9",
          700: "#0083B0",
          800: "#005978",
          900: "#002F40",
          950: "#001B24",
        },
        "accent-purple": {
          DEFAULT: "#AC8CFF",
          50: "#F5F2FF",
          100: "#E7DDFF",
          200: "#CAB4FF",
          300: "#AC8CFF",
          400: "#8F63FF",
          500: "#723AFF",
          600: "#4A02FF",
          700: "#3900C9",
          800: "#290091",
          900: "#190059",
          950: "#11003D",
        },
        "accent-falcon": {
          DEFAULT: "#AA8AA0",
          50: "#F7F4F6",
          100: "#EFE9ED",
          200: "#DED1DA",
          300: "#CCB9C6",
          400: "#BBA2B3",
          500: "#AA8AA0",
          600: "#926A85",
          700: "#715268",
          800: "#513B4A",
          900: "#30232C",
          950: "#20171D",
        },
        success: {
          DEFAULT: "#4FA884",
          50: "#C9E6DA",
          100: "#BBDFD1",
          200: "#A0D2BE",
          300: "#84C5AB",
          400: "#68B898",
          500: "#4FA884",
          600: "#428C6F",
          700: "#357059",
          800: "#285543",
          900: "#1B392D",
          950: "#12261E",
        },
        warning: {
          DEFAULT: "#FAA539",
          50: "#FEF8E7",
          100: "#FEEFCE",
          200: "#FDDB9C",
          300: "#FBC26B",
          400: "#FAA539",
          500: "#F98407",
          600: "#CD6405",
          700: "#A04704",
          800: "#742E03",
          900: "#471902",
          950: "#301001",
        },
        error: {
          DEFAULT: "#D24F5E",
          50: "#F8E2E4",
          100: "#F3D1D5",
          200: "#EBB1B7",
          300: "#E3909A",
          400: "#DB707C",
          500: "#D24F5E",
          600: "#C73243",
          700: "#A62A38",
          800: "#791F29",
          900: "#4C131A",
          950: "#360E12",
        },
      },
    },
  },
  plugins: [],
};

export default config;
