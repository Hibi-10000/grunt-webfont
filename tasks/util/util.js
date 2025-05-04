/**
 * grunt-webfont: common stuff
 *
 * @author Artem Sapegin (http://sapegin.me)
 */

import path from 'node:path';
import { globSync } from 'glob';
import { consola } from 'consola';

/** @type {Logger} */
export const consolaLogger = {
	log: {
		error: consola.error,
		warn: consola.warn,
		info: consola.info,
		verbose: consola.verbose,
	},
	fail: {
		fatal: (...args) => {
			consola.fatal.apply(null, args);
			process.exit(1);
		}
	},
}

/**
 * Unicode Private Use Area start.
 * http://en.wikipedia.org/wiki/Private_Use_(Unicode)
 */
export const UNICODE_PUA_START = 0xF101;

/**
 * @font-face’s src values generation rules.
 */
export const fontsSrcsMap = {
	eot: {
		0: {
			ext: '.eot',
		},
		1: {
			ext: '.eot?#iefix',
			format: 'embedded-opentype',
		},
	},
	woff: {
		0: /** @type {false} */(false),
		1: {
			ext: '.woff',
			format: 'woff',
			embeddable: true,
		},
	},
	woff2: {
		0: /** @type {false} */(false),
		1: {
			ext: '.woff2',
			format: 'woff2',
			embeddable: true,
		},
	},
	ttf: {
		0: /** @type {false} */(false),
		1: {
			ext: '.ttf',
			format: 'truetype',
			embeddable: true,
		},
	},
	svg: {
		0: /** @type {false} */(false),
		1: {
			ext: '.svg#{fontBaseName}',
			format: 'svg',
		},
	},
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
