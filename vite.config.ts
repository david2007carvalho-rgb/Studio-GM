import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" so the same build works inside the Android app and under a GitHub Pages sub-path.
// One JS file and one CSS file, because that pair is exactly what an over-the-air update replaces.
export default defineConfig({
	base: "./",
	plugins: [react()],
	build: { modulePreload: false, cssCodeSplit: false, rollupOptions: { output: { inlineDynamicImports: true } } },
});
