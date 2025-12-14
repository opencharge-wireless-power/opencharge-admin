import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        "fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
        "fade-out": { from: { opacity: 1 }, to: { opacity: 0 } },
        "slide-in-from-right": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "slide-out-to-right": { from: { transform: "translateX(0)" }, to: { transform: "translateX(100%)" } },
        "slide-in-from-left": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(0)" } },
        "slide-out-to-left": { from: { transform: "translateX(0)" }, to: { transform: "translateX(-100%)" } },
        "slide-in-from-top": { from: { transform: "translateY(-100%)" }, to: { transform: "translateY(0)" } },
        "slide-out-to-top": { from: { transform: "translateY(0)" }, to: { transform: "translateY(-100%)" } },
        "slide-in-from-bottom": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
        "slide-out-to-bottom": { from: { transform: "translateY(0)" }, to: { transform: "translateY(100%)" } },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out forwards",
        "fade-out": "fade-out 0.2s ease-out forwards",
        "slide-in-from-right": "slide-in-from-right 0.3s ease-out forwards",
        "slide-out-to-right": "slide-out-to-right 0.2s ease-out forwards",
        "slide-in-from-left": "slide-in-from-left 0.3s ease-out forwards",
        "slide-out-to-left": "slide-out-to-left 0.2s ease-out forwards",
        "slide-in-from-top": "slide-in-from-top 0.3s ease-out forwards",
        "slide-out-to-top": "slide-out-to-top 0.2s ease-out forwards",
        "slide-in-from-bottom": "slide-in-from-bottom 0.3s ease-out forwards",
        "slide-out-to-bottom": "slide-out-to-bottom 0.2s ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;





