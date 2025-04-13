/**
 * grunt-webfont: common stuff
 *
 * @author Artem Sapegin (http://sapegin.me)
 */

import path from 'node:path';
import { globSync } from 'glob';

/**
 * Unicode Private Use Area start.
 * http://en.wikipedia.org/wiki/Private_Use_(Unicode)
 */
export const UNICODE_PUA_START = 0xF101;

/** @typedef {(false | { ext: string, format?: string, embeddable?: boolean })[]} fontsSrcs */
/**
 * @font-face’s src values generation rules.
 * @type {{eot: fontsSrcs, woff: fontsSrcs, woff2: fontsSrcs, ttf: fontsSrcs, svg: fontsSrcs}}
 */
export const fontsSrcsMap = {
	eot: [
		{
			ext: '.eot'
		},
		{
			ext: '.eot?#iefix',
			format: 'embedded-opentype'
		}
	],
	woff: [
		false,
		{
			ext: '.woff',
			format: 'woff',
			embeddable: true
		},
	],
	woff2: [
		false,
		{
			ext: '.woff2',
			format: 'woff2',
			embeddable: true
		},
	],
	ttf: [
		false,
		{
			ext: '.ttf',
			format: 'truetype',
			embeddable: true
		},
	],
	svg: [
		false,
		{
			ext: '.svg#{fontBaseName}',
			format: 'svg'
		},
	]
};

/**
 * CSS fileaname prefixes: _icons.scss.
 */
export const cssFilePrefixes = {
	_default: '',
};

/**
 * @font-face’s src parts seperators.
 */
export const fontSrcSeparators = {
	_default: ',\n\t\t',
};

/**
 * List of available font formats.
 */
export const fontFormats = 'eot,woff2,woff,ttf,svg';

/**
 * Returns list of all generated font files.
 *
 * @param {OptionsInternal} o Options.
 */
export const generatedFontFiles = (o) => {
	const mask = `*.{${o.types}}`;
	return globSync(path.posix.join(o.dest, o.fontFilename + mask));
};

/**
 * Returns path to font of specified format.
 *
 * @param {OptionsInternal} o Options.
 * @param {string} type Font type (see `wf.fontFormats`).
 */
export const getFontPath = (o, type) => {
	return path.join(o.dest, `${o.fontFilename}.${type}`);
};
