// From DefinitelyTyped with some changes to match the new version
// Kaspar Vollenweider (casaper), MIT License

declare module 'ttf2eot' {
	export default function ttf2eot(ttf: UInt8Array): UInt8Array;
}

declare module 'ttf2woff' {
	export default function ttf2woff(ttf: UInt8Array, options?: {
		/**
		 * Woff Extended Metadata Block
		 *
		 * See https://www.w3.org/TR/WOFF/#Metadata
		 */
		metadata?: string | undefined;
	}): UInt8Array;
}
