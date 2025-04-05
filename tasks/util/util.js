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
 * @type {number}
 */
export const UNICODE_PUA_START = 0xF101;

/**
 * @font-face’s src values generation rules.
 * @type {{[type: string]: (false | { ext: string, format?: string, embeddable?: boolean })[]}}
 */
export const fontsSrcsMap = {
	//eot: [
	//	{
	//		ext: '.eot'
	//	},
	//	{
	//		ext: '.eot?#iefix',
	//		format: 'embedded-opentype'
	//	}
	//],
	//woff: [
	//	false,
	//	{
	//		ext: '.woff',
	//		format: 'woff',
	//		embeddable: true
	//	},
	//],
	//woff2: [
	//	false,
	//	{
	//		ext: '.woff2',
	//		format: 'woff2',
	//		embeddable: true
	//	},
	//],
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
 * @type {{ _default: string }}
 */
export const cssFilePrefixes = {
	_default: '',
};

/**
 * @font-face’s src parts seperators.
 * @type {{ _default: string }}
 */
export const fontSrcSeparators = {
	_default: ',\n\t\t',
};

/**
 * List of available font formats.
 * @type {string}
 */
export const fontFormats = 'ttf';

/**
 * Returns list of all generated font files.
 *
 * @param {OptionsInternal} o Options.
 * @return {string[]}
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
 * @return {string}
 */
export const getFontPath = (o, type) => {
	return path.join(o.dest, `${o.fontFilename}.${type}`);
};
