import { nativePreset } from "@agent/tailwind-config/native-preset";
import type { Config } from "tailwindcss";

const config: Config = {
  presets: [nativePreset as Config],
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
};

export default config;
