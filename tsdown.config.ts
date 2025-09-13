import { defineConfig } from "tsdown";

export default defineConfig({
	entry: "tasks/webfont.ts",
	unbundle: true,
	sourcemap: true,
	format: "esm",
	cjsDefault: false,
	dts: {
		oxc: true,
	},
	copy: [
		"tasks/global.d.ts",
	],
	skipNodeModulesBundle: true,
	platform: "node",
});
