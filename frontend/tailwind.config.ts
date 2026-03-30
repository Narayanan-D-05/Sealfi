import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        black: "#0A0A0A",
        yellow: {
          DEFAULT: "#FFE500",
          dim: "#FFE50020",
        },
        white: "#F5F5F5",
        gray: {
          DEFAULT: "#888888",
          border: "#1E1E1E",
        },
      },
      fontFamily: {
        grotesk: ["Space Grotesk", "sans-serif"],
        mono: ["Space Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
