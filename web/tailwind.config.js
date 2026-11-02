/**
 * Narada's "sketchbook" palette: warm paper, navy ink, hard offset shadows and a few soft accent fills.
 * `primary` is an ink/navy scale (500 is the strong navy; white text passes AA on it), `main-bg` is the paper
 * and `secondary-text` the muted ink. The accents (`sun`, `sky`, `rose`, `mint`, `peach`) are fills only; text on
 * them is always ink.
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./ui/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
      },
      colors: {
        primary: {
          50: "#eef3fa",
          100: "#dde6f3",
          200: "#bccbe2",
          300: "#8ea4c6",
          400: "#58739c",
          500: "#1f3b63",
          600: "#182f50",
          700: "#10213a",
          800: "#0c192d",
          900: "#08111f",
        },
        "main-bg": "#fdfbf7",
        "secondary-text": "#546275",
        ink: { DEFAULT: "#10213a", line: "#0f172a", muted: "#546275" },
        paper: { DEFAULT: "#fdfbf7", warm: "#fffaf1", deep: "#f7f0e4" },
        sun: { DEFAULT: "#fde047", soft: "#fef08a", light: "#fff8c9" },
        sky: { DEFAULT: "#dbeafe", light: "#e8f1ff" },
        rose: { DEFAULT: "#f5d1da", light: "#ffe7ec" },
        mint: { DEFAULT: "#d9ecd2", light: "#ecf6e8" },
        peach: { DEFAULT: "#ffd8c8", light: "#ffece4" },
      },
      borderRadius: {
        sm: "0.375rem",
        md: "0.625rem",
        lg: "0.875rem",
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
        "4xl": "1.75rem",
      },
      boxShadow: {
        sketch: "4px 4px 0 #0f172a",
        "sketch-sm": "2px 2px 0 #0f172a",
        "sketch-lg": "6px 6px 0 #0f172a",
        board: "8px 8px 0 rgba(15, 23, 42, 0.08)",
        tile: "6px 6px 0 rgba(16, 33, 58, 0.1)",
        paper: "0 18px 48px rgba(16, 33, 58, 0.12)",
      },
    },
  },
  plugins: [],
};
