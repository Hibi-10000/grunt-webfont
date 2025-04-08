/**
 * grunt-webfont: Node.js engine
 *
 * @requires ttfautohint 1.00+ (optional)
 * @author Artem Sapegin (http://sapegin.me)
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import async from 'async';
import temp from 'temp';
import _ from 'lodash';
import svgicons2svgfont from 'svgicons2svgfont';
import svg2ttf from 'svg2ttf';
import ttf2woff from 'ttf2woff';
import ttf2eot from 'ttf2eot';
import SVGO from 'svgo';
import MemoryStream from 'memorystream';
import winston from 'winston';
import * as wf from '../util/util.js';

/** @type {(o: OptionsInternal, allDone: (result: { fontName: string } | false) => void) => void} */
export default (o, allDone) => {
	const logger = o.logger || winston;

	// @todo Ligatures

	const fonts = {};

	const generators = {
		svg: (done) => {
			let font = '';
			const decoder = new StringDecoder('utf8');
			svgFilesToStreams(o.files, (streams) => {
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
				stream.on('end', () => {
					fonts.svg = font;
					done(font);
				});
			});
		},

		ttf: (done) => {
			getFont('svg', (svgFont) => {
				let font = svg2ttf(svgFont, {});
				font = Buffer.from(font.buffer);
				autohintTtfFont(font, (hintedFont) => {
					// ttfautohint is optional
					if (hintedFont) {
						font = hintedFont;
					}
					fonts.ttf = font;
					done(font);
				});
			});
		},

		woff: (done) => {
			getFont('ttf', (ttfFont) => {
				let font = ttf2woff(new Uint8Array(ttfFont), {});
				font = Buffer.from(font.buffer);
				fonts.woff = font;
				done(font);
			});
		},

		woff2: (done) => {
			// Will be converted from TTF later
			done();
		},

		eot: (done) => {
			getFont('ttf', (ttfFont) => {
				const fontb = ttf2eot(new Uint8Array(ttfFont));
				const font = Buffer.from(fontb.buffer);
				fonts.eot = font;
				done(font);
			});
		}
	};

	const steps = [];

	// Font types
	const typesToGenerate = o.types.slice();
	if ((o.types.indexOf('woff2') !== -1) && (o.types.indexOf('ttf') === -1)) typesToGenerate.push('ttf');
	typesToGenerate.forEach((type) => {
		steps.push(createFontWriter(type));
	});

	// Run!
	async.waterfall(steps, allDone);

	function getFont(type, done) {
		if (fonts[type]) {
			done(fonts[type]);
		}
		else {
			generators[type](done);
		}
	}

	function createFontWriter(type) {
		return (done) => {
			getFont(type, (font) => {
				fs.writeFileSync(wf.getFontPath(o, type), font);
				done();
			});
		};
	}

	function svgFilesToStreams(files, done) {

		async.map(files, (file, fileDone) => {

			function fileStreamed(name, stream) {
				fileDone(null, {
					codepoint: o.codepoints[name],
					name: name,
					stream: stream
				});
			}

			function streamSVG(name, file) {
				const stream = fs.createReadStream(file);
				fileStreamed(name, stream);
			}

			function streamSVGO(name, file) {
				const svg = fs.readFileSync(file, 'utf8');
				const svgo = new SVGO();
				try {
					svgo.optimize(svg, (res) => {
						const stream = new MemoryStream(res.data, {
							writeable: false
						});
						fileStreamed(name, stream);
					});
				} catch (err) {
					logger.error('Can’t simplify SVG file with SVGO.\n\n' + err);
					fileDone(err);
				}
			}

			const idx = files.indexOf(file);
			const name = o.glyphs[idx];

			if(o.optimize === true) {
				streamSVGO(name, file);
			} else {
				streamSVG(name, file);
			}
		}, (err, streams) => {
			if (err) {
				logger.error('Can’t stream SVG file.\n\n' + err);
				allDone(false);
			}
			else {
				done(streams);
			}
		});
	}

	function autohintTtfFont(font, done) {
		temp.track();
		const tempDir = temp.mkdirSync();
		const originalFilepath = path.join(tempDir, 'font.ttf');
		const hintedFilepath = path.join(tempDir, 'hinted.ttf');

		if (!o.autoHint){
			done(false);
			return;
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

		exec(args, { maxBuffer: o.execMaxBuffer }, (err, out, code) => {
			if (err) {
				if (err.code === 127) {
					logger.verbose('Hinting skipped, ttfautohint not found.');
					done(false);
					return;
				}
				logger.error('Can’t run ttfautohint.\n\n' + err.message);
				done(false);
				return;
			}

			// Read hinted font back
			const hintedFont = fs.readFileSync(hintedFilepath);
			done(hintedFont);
		});
	}

};
