// From DefinitelyTyped with some changes to match the new version
// Kaspar Vollenweider (casaper), MIT License

declare module 'ttf2eot' {
	export default function ttf2eot(ttf: Uint8Array): Uint8Array;
}

declare module 'ttf2woff' {
	export default function ttf2woff(ttf: Uint8Array, options?: {
		/**
		 * Woff Extended Metadata Block
		 *
		 * See https://www.w3.org/TR/WOFF/#Metadata
		 */
		metadata?: string | undefined;
	}): Uint8Array;
}

declare module 'ttf2woff2' {
	const ttf2woff2: NonNullable<(ttf: Uint8Array) => Uint8Array>;
	export default ttf2woff2;
}
