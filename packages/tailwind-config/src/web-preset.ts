import type { Config } from "tailwindcss";
import { baseConfig } from "./base.js";

export const webPreset: Partial<Config> = {
  ...baseConfig,
  darkMode: "class",
};

export default webPreset;
