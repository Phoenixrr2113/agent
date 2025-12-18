import { webPreset } from "@agent/tailwind-config/web-preset";
import type { Config } from "tailwindcss";

const config: Config = {
  presets: [webPreset as Config],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
};

export default config;
