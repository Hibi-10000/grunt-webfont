/**
 * grunt-webfont: common stuff
 *
 * @author Artem Sapegin (http://sapegin.me), Hibi_10000
 */

import path from 'node:path';
import { globSync } from 'glob';
import { consola } from 'consola';

import type { Logger, OptionsInternal } from '../types.ts';

consola.options.throttle = 300;

export const consolaLogger: Logger = {
	log: {
		error: consola.error.raw,
		warn: consola.warn.raw,
		info: consola.info.raw,
		verbose: consola.debug.raw,
	},
	fail: {
		fatal: (...args) => {
			consola.fatal.raw(...args);
			process.exit(1);
		}
	},
}

export const showConsolaVerbose = () => {
	consola.level = 4; // debug
};

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
		0: false as false,
		1: {
			ext: '.woff',
			format: 'woff',
			embeddable: true,
		},
	},
	woff2: {
		0: false as false,
		1: {
			ext: '.woff2',
			format: 'woff2',
			embeddable: true,
		},
	},
	ttf: {
		0: false as false,
		1: {
			ext: '.ttf',
			format: 'truetype',
			embeddable: true,
		},
	},
	svg: {
		0: false as false,
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
	sass: '_',
	scss: '_'
};

/**
 * @font-face’s src parts seperators.
 */
export const fontSrcSeparators = {
	_default: ',\n\t\t',
	styl: ', '
};

/**
 * List of available font formats.
 */
export const fontFormats = 'eot,woff2,woff,ttf,svg';

/**
 * Returns list of all generated font files.
 *
 * @param o Options.
 */
export const generatedFontFiles = (o: OptionsInternal): string[] => {
	return globSync(path.posix.join(o.dest, `${o.fontFilename}*.{${o.types}}`));
};

/**
 * Returns path to font of specified format.
 *
 * @param o Options.
 * @param type Font type (see `wf.fontFormats`).
 */
export const getFontPath = (o: OptionsInternal, type: string): string => {
	return path.join(o.dest, `${o.fontFilename}.${type}`);
};
