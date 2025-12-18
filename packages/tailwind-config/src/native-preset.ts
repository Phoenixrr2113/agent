import type { Config } from "tailwindcss";
import { baseConfig } from "./base.js";

export const nativePreset: Partial<Config> = {
  ...baseConfig,
  presets: [require("nativewind/preset")],
};

export default nativePreset;
