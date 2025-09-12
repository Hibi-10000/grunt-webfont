import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["tasks/**/!(*.d).{js,ts}"],
	splitting: true,
    sourcemap: true,
    clean: true,
    format: "esm",
    dts: {
		entry: ["tasks/webfont.ts"],
	},
	bundle: false,
	platform: "node",
});
