import { defineConfig } from "tsdown";

export default defineConfig({
	entry: "tasks/webfont.ts",
	unbundle: true,
	sourcemap: true,
	format: "esm",
	cjsDefault: false,
	fixedExtension: false,
	dts: {
		oxc: true,
	},
	skipNodeModulesBundle: true,
	platform: "node",
	report: {
		gzip: false,
	}
});
