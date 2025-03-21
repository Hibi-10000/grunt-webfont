/**
 * grunt-webfont: common stuff
 *
 * @author Artem Sapegin (http://sapegin.me)
 */

import path from 'node:path';
import glob from 'glob';

/**
 * Unicode Private Use Area start.
 * http://en.wikipedia.org/wiki/Private_Use_(Unicode)
 * @type {Number}
 */
export const UNICODE_PUA_START = 0xF101;

/**
 * @font-face’s src values generation rules.
 * @type {Object}
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
 * @type {Object}
 */
export const cssFilePrefixes = {
	_default: '',
};

/**
 * @font-face’s src parts seperators.
 * @type {Object}
 */
export const fontSrcSeparators = {
	_default: ',\n\t\t',
};

/**
 * List of available font formats.
 * @type {String}
 */
export const fontFormats = 'ttf';

/**
 * Returns list of all generated font files.
 *
 * @param {Object} o Options.
 * @return {Array}
 */
export const generatedFontFiles = (o) => {
	const mask = '*.{' + o.types + '}';
	return glob.sync(path.join(o.dest, o.fontFilename + mask));
};

/**
 * Returns path to font of specified format.
 *
 * @param {Object} o Options.
 * @param {String} type Font type (see `wf.fontFormats`).
 * @return {String}
 */
export const getFontPath = (o, type) => {
	return path.join(o.dest, o.fontFilename + '.' + type);
};
