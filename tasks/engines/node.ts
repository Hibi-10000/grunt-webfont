/**
 * grunt-webfont: Node.js engine
 *
 * @requires ttfautohint 1.00+ (optional)
 * @author Artem Sapegin (http://sapegin.me), Hibi_10000
 */

import fs from 'node:fs';
import stream from 'node:stream';
import path from 'node:path';
import util from 'node:util';
import { exec } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import temp from 'temp';
import { SVGIcons2SVGFontStream } from 'svgicons2svgfont';
import svg2ttf from 'svg2ttf';
import ttf2woff from 'ttf2woff';
import ttf2eot from 'ttf2eot';
import * as svgo from 'svgo';
import which from 'which';

import * as wf from '../util/util.ts';
import type { OptionsInternal, ReadableStreamWithMetadata } from '../types.ts';

export default async (o: OptionsInternal): Promise<false> => {
	const logger = o.logger || wf.consolaLogger;

	// @todo Ligatures

	const fonts: { svg?: string, ttf?: Uint8Array, woff?: Uint8Array, eot?: Uint8Array } = {};

	const generators = {
		svg: async () => {
			let font = '';
			const decoder = new StringDecoder('utf8');
			const streams = svgFilesToStreams(o.files);
			const fontStream = new SVGIcons2SVGFontStream({
				fontName: o.fontFamilyName,
				fontHeight: o.fontHeight,
				descent: o.descent,
				normalize: o.normalize,
				round: o.round,
			});
			fontStream.on('data', (chunk) => {
				font += decoder.write(chunk);
			});
			await new Promise<void>((resolve) => {
				fontStream.on('end', () => {
					fonts.svg = font;
					resolve();
				});
				for (const s of streams) {
					const svgStream = s.stream as ReadableStreamWithMetadata;
					svgStream.metadata = {
						unicode: [String.fromCodePoint(s.codepoint)],
						name: s.name,
					}
					fontStream.write(svgStream);
				}
				fontStream.end();
			});
			return font;
		},

		ttf: async () => {
			const svgFont = await getFont('svg')
			let font = svg2ttf(svgFont, {}).buffer;
			const hintedFont = await autohintTtfFont(font)
			// ttfautohint is optional
			if (hintedFont) {
				font = hintedFont;
			}
			fonts.ttf = font;
			return font;
		},

		woff: async () => {
			const ttfFont = await getFont('ttf')
			const font = ttf2woff(ttfFont, {});
			fonts.woff = font;
			return font;
		},

		woff2: async () => {
			// Will be converted from TTF later
		},

		eot: async () => {
			const ttfFont = await getFont('ttf')
			const font = ttf2eot(ttfFont);
			fonts.eot = font;
			return font;
		}
	};

	// Font types
	const typesToGenerate = o.types.slice();
	if ((o.types.indexOf('woff2') !== -1) && (o.types.indexOf('ttf') === -1)) typesToGenerate.push('ttf');
	try {
		for (const type of typesToGenerate) {
			if (type === 'woff2') continue;
			//@ts-ignore
			await createFontWriter(type);
		}
	} catch (e) {
		return false;
	}

	async function getFont(type: 'svg'): Promise<string>;
	async function getFont(type: 'eot' | 'woff' | 'ttf'): Promise<Uint8Array>;
	async function getFont(type: 'eot' | 'woff' | 'ttf' | 'svg'): Promise<string | Uint8Array>;
	async function getFont(type: 'eot' | 'woff' | 'ttf' | 'svg') {
		if (fonts[type]) {
			return fonts[type];
		} else {
			return await generators[type]();
		}
	}

	async function createFontWriter(type: 'eot' | 'woff' | 'ttf' | 'svg') {
		const font = await getFont(type)
		fs.writeFileSync(wf.getFontPath(o, type), font);
	}

	type Stream = { codepoint: number, name?: string, stream: NodeJS.ReadableStream };
	function svgFilesToStreams(files: string[]) {
		try {
			return files.map((file) => {

				function fileStreamed(name: string, stream: NodeJS.ReadableStream): Stream {
					return {
						codepoint: o.codepoints[name],
						name: name,
						stream: stream,
					};
				}

				function streamSVG(name: string, file: string) {
					const stream = fs.createReadStream(file);
					return fileStreamed(name, stream);
				}

				function streamSVGO(name: string, file: string) {
					const svg = fs.readFileSync(file, 'utf8');
					try {
						const optimized = svgo.optimize(svg).data;
						const strStream = stream.Readable.from(optimized);
						return fileStreamed(name, strStream);
					} catch (err) {
						logger.log.error('Can’t simplify SVG file with SVGO.\n\n' + err);
						throw err;
					}
				}

				const idx = files.indexOf(file);
				const name = o.glyphs[idx];

				if (o.optimize === true) {
					return streamSVGO(name, file)
				} else {
					return streamSVG(name, file);
				}
			});
		} catch (err) {
			logger.log.error('Can’t stream SVG file.\n\n' + err);
			throw err;
		}
	}

	async function autohintTtfFont(font: Uint8Array) {
		if (!which.sync('ttfautohint', { nothrow: true })) {
			logger.log.verbose('Hinting skipped, ttfautohint not found.');
			return false;
		}

		temp.track();
		const tempDir = temp.mkdirSync();
		const originalFilepath = path.join(tempDir, 'font.ttf');
		const hintedFilepath = path.join(tempDir, 'hinted.ttf');

		if (!o.autoHint){
			return false;
		}
		// Save original font to temporary directory
		fs.writeFileSync(originalFilepath, font);

		// Run ttfautohint
		const args = [
			'ttfautohint',
			'--symbol',
			'--fallback-script=latn',
			'--windows-compatibility',
			'--no-info',
			originalFilepath,
			hintedFilepath
		].join(' ');

		const execPromise = util.promisify(exec);
		try {
			await execPromise(args, { maxBuffer: o.execMaxBuffer });
		} catch (err) {
			if (err.code === 127) {
				logger.log.verbose('Hinting skipped, ttfautohint not found.');
				return false;
			}
			logger.log.error('Can’t run ttfautohint.\n\n' + err.message);
			return false;
		}
		const hintedFont = fs.readFileSync(hintedFilepath);
		return hintedFont;
	}

};
