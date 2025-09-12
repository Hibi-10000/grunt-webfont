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
	plugins: [
		{
			name: "replace-ts-import",
			renderChunk(code) {
				return { code: code.replace(/(import .*? from ['"][^'"]*?)\.ts(['"])/g, '$1.js$2') };
			},
		}
	],
});
