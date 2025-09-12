import { defineConfig } from "tsdown";

export default defineConfig({
    entry: "tasks/webfont.ts",
	unbundle: true,
    sourcemap: true,
    format: "esm",
	cjsDefault: false,
	dts: true,
	skipNodeModulesBundle: true,
	platform: "node",
});
