/**
 * grunt-webfont: Node.js engine
 *
 * @requires ttfautohint 1.00+ (optional)
 * @author Artem Sapegin (http://sapegin.me)
 */
'use strict';

import fs from 'node:fs';
import stream from 'node:stream';
import path from 'node:path';
import util from 'node:util';
import { exec } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import temp from 'temp';
import _ from 'lodash';
import svgicons2svgfont from 'svgicons2svgfont';
import svg2ttf from 'svg2ttf';
import ttf2woff from 'ttf2woff';
import ttf2eot from 'ttf2eot';
import svgo from 'svgo';
import which from 'which';
import winston from 'winston';
import * as wf from '../util/util.js';

/** @type {(o: OptionsInternal, allDone: (result?: false) => void) => void} */
export default (o, allDone) => {
	const logger = o.logger || winston;

	// @todo Ligatures

	/** @type {{ svg?: string, ttf?: Uint8Array, woff?: Uint8Array, eot?: Uint8Array }} */
	const fonts = {};

	const generators = {
		svg: async () => {
			let font = '';
			const decoder = new StringDecoder('utf8');
			const streams = svgFilesToStreams(o.files);
			const stream = svgicons2svgfont(streams, {
				fontName: o.fontFamilyName,
				fontHeight: o.fontHeight,
				descent: o.descent,
				normalize: o.normalize,
				round: o.round,
				log: logger.verbose.bind(logger),
				error: logger.error.bind(logger)
			});
			stream.on('data', (chunk) => {
				font += decoder.write(chunk);
			});
			await new Promise((resolve) => {
				stream.on('end', () => {
					fonts.svg = font;
					resolve();
				});
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
	(async () => {
		for (const type of typesToGenerate) {
			if (type === 'woff2') continue;
			await createFontWriter(type);
		}
	})().catch(() => allDone(false)).finally(allDone);

	/**
	 * @overload
	 * @param {'svg'} type
	 * @returns {Promise<string>}
	 *
	 * @overload
	 * @param {'ttf' | 'woff' | 'eot'} type
	 * @returns {Promise<Uint8Array>}
	 *
	 * @overload
	 * @param {string} type
	 * @returns {Promise<string | Uint8Array>}
	 *
	 * @type {(type: string) => Promise<string | Uint8Array>}
	 */
	async function getFont(type) {
		if (fonts[type]) {
			return fonts[type];
		}
		else {
			return await generators[type]();
		}
	}

	async function createFontWriter(/** @type {string} */type) {
		const font = await getFont(type)
		fs.writeFileSync(wf.getFontPath(o, type), font);
	}

	/** @typedef {{ codepoint: number, name?: string, stream: NodeJS.ReadableStream }} Stream */
	function svgFilesToStreams(/** @type {string[]} */files) {
		try {
			return files.map((file) => {

				/** @type {(name: string, stream: NodeJS.ReadableStream) => Stream} */
				function fileStreamed(name, stream) {
					return {
						codepoint: o.codepoints[name],
						name: name,
						stream: stream
					};
				}

				/** @type {(name: string, file: string) => Stream} */
				function streamSVG(name, file) {
					const stream = fs.createReadStream(file);
					return fileStreamed(name, stream);
				}

				/** @type {(name: string, file: string) => Stream} */
				function streamSVGO(name, file) {
					const svg = fs.readFileSync(file, 'utf8');
					try {
						const optimized = svgo.optimize(svg).data;
						const strStream = stream.Readable.from(optimized);
						return fileStreamed(name, strStream);
					} catch (err) {
						logger.error('Can’t simplify SVG file with SVGO.\n\n' + err);
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
			logger.error('Can’t stream SVG file.\n\n' + err);
			throw err;
		}
	}

	async function autohintTtfFont(/** @type {Uint8Array} */font) {
		if (!which.sync('ttfautohint', { nothrow: true })) {
			logger.verbose('Hinting skipped, ttfautohint not found.');
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
				logger.verbose('Hinting skipped, ttfautohint not found.');
				return false;
			}
			logger.error('Can’t run ttfautohint.\n\n' + err.message);
			return false;
		}
		const hintedFont = fs.readFileSync(hintedFilepath);
		return hintedFont;
	}

};
