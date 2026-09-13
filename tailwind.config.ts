import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: { brand: { 50: "#eef6ff", 100: "#d9eaff", 500: "#1d6fe0", 600: "#1659b8", 700: "#124894" } } } },
  plugins: [],
} satisfies Config;
