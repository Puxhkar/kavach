import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the theme's named shadows and fonts so `shadow-sketch` overrides `shadow-board`, etc.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      shadow: [{ shadow: ["sketch", "sketch-sm", "sketch-lg", "board", "tile", "paper"] }],
      "font-family": [{ font: ["serif"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
