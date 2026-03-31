import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      fontFamily: {
        heading: ["var(--font-space-grotesk)", "sans-serif"],
        mono: ["var(--font-space-mono)", "monospace"],
        sans: ["var(--font-space-grotesk)", "sans-serif"],
      },
      colors: {
        primary: "#E41E26",
        background: "#ffffff",
        foreground: "#000000",
        border: "#000000",
      },
      borderRadius: {
        "neo": "24px",
      },
      boxShadow: {
        "neo": "8px 8px 0px 0px rgba(0,0,0,1)",
        "neo-hover": "12px 12px 0px 0px rgba(0,0,0,1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
export default config
