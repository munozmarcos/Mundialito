import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        field: "#10213A",
        ink: "#F4F8FF",
        grass: "#46E36F",
        mint: "#123F2A",
        gold: "#FFD02F",
        line: "#27415F"
      }
    }
  },
  plugins: []
};

export default config;
