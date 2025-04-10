/**
 * SVG to webfont converter for Grunt
 *
 * @requires ttfautohint
 * @author Artem Sapegin (http://sapegin.me)
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { globSync } from 'glob';
import chalk from 'chalk';
// updates to v6 are blocked by https://github.com/nfroidure/ttf2woff2/issues/87
import ttf2woff2 from 'ttf2woff2';
import _ from 'lodash';
import fontforge from './engines/fontforge.js';
import node from './engines/node.js';
import * as wf from './util/util.js';

import packageJson from '../package.json' with { type: "json" };

export default (/** @type {import('grunt')} */grunt) => {
	grunt.registerMultiTask('webfont', 'Compile separate SVG files to webfont', function() {

		/**
		 * Winston to Grunt logger adapter.
		 */
		const logger = {
			warn: function() {
				grunt.log.warn.apply(null, arguments);
			},
			error: function() {
				grunt.warn.apply(null, arguments);
			},
			log: function() {
				grunt.log.writeln.apply(null, arguments);
			},
			verbose: function() {
				grunt.log.verbose.writeln.apply(null, arguments);
			}
		};

		const allDone = this.async();
		const params = this.data;
		const options = this.options(/** @type {Options} */(undefined));
		const md5 = crypto.createHash('md5');

		/*
		 * Check for `src` param on target config
		 */
		this.requiresConfig([this.name, this.target, 'src'].join('.'));

		/*
		 * Check for `dest` param on either target config or global options object
		 */
		if (_.isUndefined(params.dest) && _.isUndefined(options.dest)) {
			logger.warn(`Required property ${this.name}.${this.target}.dest or ${this.name}.${this.target}.options.dest missing.`);
		}

		if (options.skip) {
			completeTask();
			return;
		}

		// Source files
		const files = _.filter(this.filesSrc, isSvgFile);
		if (!files.length) {
			logger.warn('Specified empty list of source SVG files.');
			completeTask();
			return;
		}

		// path must be a string, see https://nodejs.org/api/path.html#path_path_extname_path
		if (typeof options.template !== 'string') {
			options.template = '';
		}

		// Options
		/** @type {OptionsInternal} */
		let o = {
			logger: logger,
			fontBaseName: options.font || 'icons',
			destCss: options.destCss || params.destCss || params.dest,
			dest: options.dest || params.dest,
			relativeFontPath: options.relativeFontPath,
			addHashes: options.hashes !== false,
			addLigatures: options.ligatures === true,
			template: options.template,
			syntax: options.syntax || 'bem',
			templateOptions: options.templateOptions || {},
            stylesheets: ['css'],
			htmlDemo: options.htmlDemo !== false,
			htmlDemoTemplate: options.htmlDemoTemplate,
			htmlDemoFilename: options.htmlDemoFilename,
			styles: optionToArray(options.styles, 'font,icon'),
			types: optionToArray(options.types, 'eot,woff,ttf'),
			order: optionToArray(options.order, wf.fontFormats),
			embed: options.embed === true ? ['woff'] : optionToArray(options.embed, false),
			rename: options.rename || path.basename,
			engine: options.engine || 'fontforge',
			autoHint: options.autoHint !== false,
			codepoints: options.codepoints,
			codepointsFile: options.codepointsFile,
			startCodepoint: options.startCodepoint || wf.UNICODE_PUA_START,
			ie7: options.ie7 === true,
			normalize: options.normalize === true,
			optimize: options.optimize === false ? false : true,
			round: options.round !== undefined ? options.round : 10e12,
			fontHeight: options.fontHeight !== undefined ? options.fontHeight : 512,
			descent: options.descent !== undefined ? options.descent : 64,
			version: options.version !== undefined ? options.version : false,
			cache: options.cache || path.join(import.meta.dirname, '..', '.cache'),
			callback: options.callback,
			customOutputs: options.customOutputs,
			execMaxBuffer: options.execMaxBuffer || 1024 * 200
		};

		o = _.extend(o, {
			fontName: o.fontBaseName,
			destCssPaths: {
				css: o.destCss,
			},
			relativeFontPath: o.relativeFontPath || path.relative(o.destCss, o.dest),
			destHtml: options.destHtml || o.destCss,
			fontfaceStyles: has(o.styles, 'font'),
			baseStyles: has(o.styles, 'icon'),
			extraStyles: has(o.styles, 'extra'),
			files: files,
			glyphs: []
		});

		o.hash = getHash();
		o.fontFilename = template(options.fontFilename || o.fontBaseName, o);
		o.fontFamilyName = template(options.fontFamilyName || o.fontBaseName, o);

		// “Rename” files
		o.glyphs = o.files.map((file) => {
			return o.rename(file).replace(path.extname(file), '');
		});

		// Check or generate codepoints
		// @todo Codepoint can be a Unicode code or character.
		let currentCodepoint = o.startCodepoint;
		if (!o.codepoints) o.codepoints = {};
		if (o.codepointsFile) o.codepoints = readCodepointsFromFile();
		o.glyphs.forEach((name) => {
			if (!o.codepoints[name]) {
				o.codepoints[name] = getNextCodepoint();
			}
		});
		if (o.codepointsFile) saveCodepointsToFile();

		// Check if we need to generate font
		const previousHash = readHash(this.name, this.target);
		logger.verbose('New hash:', o.hash, '- previous hash:', previousHash);
		if (o.hash === previousHash) {
			logger.verbose('Config and source files weren’t changed since last run, checking resulting files...');
			let regenerationNeeded = false;

			const generatedFiles = wf.generatedFontFiles(o);
			if (!generatedFiles.length){
				regenerationNeeded = true;
			}
			else {
				generatedFiles.push(getDemoFilePath());
				o.stylesheets.forEach((stylesheet) => {
					generatedFiles.push(getCssFilePath(stylesheet));
				});

				regenerationNeeded = _.some(generatedFiles, (filename) => {
					if (!filename) return false;
					if (!fs.existsSync(filename)) {
						logger.verbose('File', filename, ' is missed.');
						return true;
					}
					return false;
				});
			}
			if (!regenerationNeeded) {
				logger.log(`Font ${chalk.cyan(o.fontName)} wasn’t changed since last run.`);
				completeTask();
				return;
			}
		}

		// Save new hash and run
		saveHash(this.name, this.target, o.hash);
		(async () => {
			createOutputDirs();
			cleanOutputDir();
			await generateFont();
			generateWoff2Font();
			generateStylesheets();
			await generateDemoHtml();
			generateCustomOutputs();
			printDone();
		})().finally(completeTask);

		/**
		 * Call callback function if it was specified in the options.
		 */
		function completeTask() {
			if (o && _.isFunction(o.callback)) {
				o.callback(o.fontName, o.types, o.glyphs, o.hash);
			}
			allDone();
		}

		/**
		 * Calculate hash to flush browser cache.
		 * Hash is based on source SVG files contents, task options and grunt-webfont version.
		 *
		 * @return {string}
		 */
		function getHash() {
			// Source SVG files contents
			o.files.forEach((file) => {
				md5.update(fs.readFileSync(file, 'utf8'));
			});

			// Options
			md5.update(JSON.stringify(o));

			// grunt-webfont version
			md5.update(packageJson.version);

			// Templates
			if (o.template) {
				md5.update(fs.readFileSync(o.template, 'utf8'));
			}
			if (o.htmlDemoTemplate) {
				md5.update(fs.readFileSync(o.htmlDemoTemplate, 'utf8'));
			}

			return md5.digest('hex');
		}

		/**
		 * Create output directory
		 */
		function createOutputDirs() {
			o.stylesheets.forEach((stylesheet) => {
				fs.mkdirSync(option(o.destCssPaths, stylesheet), { recursive: true });
			});
			fs.mkdirSync(o.dest, { recursive: true });
		}

		/**
		 * Clean output directory
		 */
		function cleanOutputDir() {
			const htmlDemoFileMask = path.posix.join(o.destCss, o.fontBaseName + '*.{css,html}');
			const files = globSync(htmlDemoFileMask).concat(wf.generatedFontFiles(o));
			files.forEach(file => {
				fs.unlinkSync(file);
			});
		}

		/**
		 * Generate font using selected engine
		 */
		async function generateFont() {
			const f = o.engine === 'node' ? node : fontforge;
			await new Promise(resolve => f(o, result => {
				if (result === false) {
					// Font was not created, exit
					completeTask();
					return;
				}

				if (result) {
					o = _.extend(o, result);
				}

				resolve();
			}));
		}

		/**
		 * Converts TTF font to WOFF2.
		 */
		function generateWoff2Font() {
			if (!has(o.types, 'woff2')) {
				return;
			}

			// Read TTF font
			const ttfFontPath = wf.getFontPath(o, 'ttf');
			const ttfFont = fs.readFileSync(ttfFontPath);

			// Remove TTF font if not needed
			if (!has(o.types, 'ttf')) {
				fs.unlinkSync(ttfFontPath);
			}

			// Convert to WOFF2
			const woffFont = ttf2woff2(ttfFont);

			// Save
			const woff2FontPath = wf.getFontPath(o, 'woff2');
			fs.writeFileSync(woff2FontPath, woffFont);
		}

		/**
		 * Generate CSS
		 */
		function generateStylesheets() {
			// Convert codepoints to array of strings
			const codepoints = [];
			_.each(o.glyphs, (name) => {
				codepoints.push(o.codepoints[name].toString(16));
			});
			o.codepoints = codepoints;

			// Prepage glyph names to use as CSS classes
			o.glyphs = _.map(o.glyphs, classnameize);

			o.stylesheets.sort((a, b) => {
				return a === 'css' ? 1 : -1;
			}).forEach(generateStylesheet);
		}

		/**
		 * Generate CSS
		 *
		 * @param {string} stylesheet type: css, scss, ...
		 */
		function generateStylesheet(stylesheet) {
			o.relativeFontPath = normalizePath(o.relativeFontPath);

			// Generate font URLs to use in @font-face
			const fontSrcs = [[], []];
			o.order.forEach((type) => {
				if (!has(o.types, type)) return;
				wf.fontsSrcsMap[type].forEach((font, idx) => {
					if (font) {
						fontSrcs[idx].push(generateFontSrc(type, font, stylesheet));
					}
				});
			});

			// Convert urls to strings that could be used in CSS
			const fontSrcSeparator = option(wf.fontSrcSeparators, stylesheet);
			fontSrcs.forEach((font, idx) => {
				// o.fontSrc1, o.fontSrc2
				o[`fontSrc${idx + 1}`] = font.join(fontSrcSeparator);
			});
			o.fontRawSrcs = fontSrcs;

			// Read JSON file corresponding to CSS template
			const templateJson = readTemplate(o.template, o.syntax, '.json', true);
			if (templateJson) o = _.extend(o, JSON.parse(templateJson.template));

			// Now override values with templateOptions
			if (o.templateOptions) o = _.extend(o, o.templateOptions);

			// Generate CSS
			const ext = path.extname(o.template) || '.css';  // Use extension of o.template file if given, or default to .css
			o.cssTemplate = readTemplate(o.template, o.syntax, ext);
			const cssContext = _.extend(o, {
				iconsStyles: true,
				stylesheet: stylesheet
			});

			const css = renderTemplate(o.cssTemplate, cssContext);

			// Save file
			fs.writeFileSync(getCssFilePath(stylesheet), css);
		}

		/**
		 * Gets the codepoints from the set filepath in o.codepointsFile
		 */
		function readCodepointsFromFile(){
			if (!o.codepointsFile) return {};
			if (!fs.existsSync(o.codepointsFile)){
				logger.verbose('Codepoints file not found');
				return {};
			}

			const buffer = fs.readFileSync(o.codepointsFile);
			return JSON.parse(buffer.toString());
		}

		/**
		 * Saves the codespoints to the set file
		 */
		function saveCodepointsToFile(){
			if (!o.codepointsFile) return;
			const codepointsToString = JSON.stringify(o.codepoints, null, 4);
			try {
				fs.writeFileSync(o.codepointsFile, codepointsToString);
				logger.verbose(`Codepoints saved to file "${o.codepointsFile}".`);
			} catch (err) {
				logger.error(err.message);
			}
		}

		/*
		 * Prepares base context for templates
		 */
		function prepareBaseTemplateContext() {
			const context = _.extend({}, o);
			return context;
		}

		/*
		 * Makes custom extends necessary for use with preparing the template context
		 * object for the HTML demo.
		 */
		function prepareHtmlTemplateContext() {

			let context = prepareBaseTemplateContext();

			let htmlStyles;

			// Prepare relative font paths for injection into @font-face refs in HTML
			const relativeRe = new RegExp(_.escapeRegExp(o.relativeFontPath).replace(/[=!:\/]/g, '\\$&'), 'g');
			const htmlRelativeFontPath = normalizePath(path.relative(o.destHtml, o.dest));
			const _fontSrc1 = o.fontSrc1.replace(relativeRe, htmlRelativeFontPath);
			const _fontSrc2 = o.fontSrc2.replace(relativeRe, htmlRelativeFontPath);

			context = _.extend(context, {
				fontSrc1: _fontSrc1,
				fontSrc2: _fontSrc2,
				fontfaceStyles: true,
				baseStyles: true,
				extraStyles: false,
				iconsStyles: true,
				stylesheet: 'css'
			});

			// Prepares CSS for injection into <style> tag at to of HTML
			htmlStyles = renderTemplate(o.cssTemplate, context);
			context = _.extend(context, {
				styles: htmlStyles
			});

			return context;
		}

		/*
		 * Iterator function used as callback by looping construct below to
		 * render "custom output" via mini configuration objects specified in
		 * the array `options.customOutputs`.
		 */
		function generateCustomOutput(outputConfig) {

			// Accesses context
			let context = prepareBaseTemplateContext();
			context = _.extend(context, outputConfig.context);

			// Prepares config attributes related to template filepath
			const templatePath = outputConfig.template;
			const extension = path.extname(templatePath);
			const syntax = outputConfig.syntax || '';

			// Renders template with given context
			const template = readTemplate(templatePath, syntax, extension);
			const output = renderTemplate(template, context);

			// Prepares config attributes related to destination filepath
			const dest = outputConfig.dest || o.dest;

			let filepath;
			let destParent;
			let destName;

			if (path.extname(dest) === '') {
				// If user specifies a directory, filename should be same as template
				destParent = dest;
				destName = path.basename(outputConfig.template);
				filepath = path.join(dest, destName);
			}
			else {
				// If user specifies a file, that is our filepath
				destParent = path.dirname(dest);
				filepath = dest;
			}

			// Ensure existence of parent directory and output to file as desired
			fs.mkdirSync(destParent, { recursive: true });
			fs.writeFileSync(filepath, output);
		}

		/*
		 * Iterates over entries in the `options.customOutputs` object and,
		 * on a config-by-config basis, generates the desired results.
		 */
		function generateCustomOutputs() {
			if (!o.customOutputs || o.customOutputs.length < 1) {
				return;
			}

			_.each(o.customOutputs, generateCustomOutput);
		}

		/**
		 * Generate HTML demo page
		 */
		async function generateDemoHtml() {
			if (!o.htmlDemo) {
				return;
			}

			const context = prepareHtmlTemplateContext();

			// Generate HTML
			const demoTemplate = readTemplate(o.htmlDemoTemplate, 'demo', '.html');
			const demo = renderTemplate(demoTemplate, context);

			try {
				await fs.promises.mkdir(getDemoPath(), { recursive: true });
			} catch (err) {
				if (err) {
					logger.log(err);
					return;
				}
			}
			// Save file
			fs.writeFileSync(getDemoFilePath(), demo);

		}

		/**
		 * Print log
		 */
		function printDone() {
			logger.log(`Font ${chalk.cyan(o.fontName)} with ${o.glyphs.length} glyphs created.`);
		}


		/**
		 * Helpers
		 */

		/**
		 * Convert a string of comma separated words into an array
		 *
		 * @param {string | false} val Input string
		 * @param {string | false} defVal Default value
		 * @return {string[]}
		 */
		function optionToArray(val, defVal) {
			if (val === undefined) {
				val = defVal;
			}
			if (!val) {
				return [];
			}
			if (typeof val !== 'string') {
				return val;
			}
			return val.split(',').map(_.trim);
		}

		/**
		 * Check if a value exists in an array
		 *
		 * @param {string[] | string} haystack Array to find the needle in
		 * @param {string} needle Value to find
		 * @return {boolean} Needle was found
		 */
		function has(haystack, needle) {
			return haystack.indexOf(needle) !== -1;
		}

		/**
		 * Return a specified option if it exists in an object or `_default` otherwise
		 *
		 * @param {{ _default?: string, [key: string]: string }} map Options object
		 * @param {string} key Option to find in the object
		 * @return {string}
		 */
		function option(map, key) {
			if (key in map) {
				return map[key];
			}
			else {
				return map._default;
			}
		}

		/**
		 * Find next unused codepoint.
		 *
		 * @return {number}
		 */
		function getNextCodepoint() {
			while (_.invert(o.codepoints).hasOwnProperty(currentCodepoint)) {
				currentCodepoint++;
			}
			return currentCodepoint;
		}

		/**
		 * Check whether file is SVG or not
		 *
		 * @param {string} filepath File path
		 * @return {boolean}
		 */
		function isSvgFile(filepath) {
			return path.extname(filepath).toLowerCase() === '.svg';
		}

		/**
		 * Convert font file to data:uri and remove source file
		 *
		 * @param {string} fontFile Font file path
		 * @return {string} Base64 encoded string
		 */
		function embedFont(fontFile) {
			// Convert to data:uri
			const dataUri = fs.readFileSync(fontFile, 'base64');
			const type = path.extname(fontFile).substring(1);
			const fontUrl = `data:application/x-font-${type};charset=utf-8;base64,${dataUri}`;

			// Remove font file
			fs.unlinkSync(fontFile);

			return fontUrl;
		}

		/**
		 * Append a slash to end of a filepath if it not exists and make all slashes forward
		 *
		 * @param {string} filepath File path
		 * @return {string}
		 */
		function normalizePath(filepath) {
			if (!filepath.length) return filepath;

			// Make all slashes forward
			filepath = filepath.replace(/\\/g, '/');

			// Make sure path ends with a slash
			if (!filepath.endsWith('/')) {
				filepath += '/';
			}

			return filepath;
		}

		/**
		 * Generate URL for @font-face
		 *
		 * @param {string} type Type of font
		 * @param {object} font URL or Base64 string
		 * @param {string} stylesheet type: css, scss, ...
		 * @return {string}
		 */
		function generateFontSrc(type, font, stylesheet) {
			const filename = template(o.fontFilename + font.ext, o);

			let url;
			if (font.embeddable && has(o.embed, type)) {
				url = embedFont(path.join(o.dest, filename));
			}
			else {
				url = o.relativeFontPath + filename;
				if (o.addHashes) {
					if (url.indexOf('#iefix') === -1) {  // Do not add hashes for OldIE
						// Put hash at the end of an URL or before #hash
						url = url.replace(/(#|$)/, `?${o.hash}$1`);
					}
					else {
						url = url.replace(/(#|$)/, `${o.hash}$1`);
					}
				}
			}

			let src = `url("${url}")`;

			if (font.format) src += ` format("${font.format}")`;

			return src;
		}

		/**
		 * Read the template file
		 *
		 * @param {string} template Template file path
		 * @param {string} syntax Syntax (bem, bootstrap, etc.)
		 * @param {string} ext Extension of the template
		 * @return {object} {filename: 'Template filename', template: 'Template code'}
		 */
		function readTemplate(template, syntax, ext, optional) {
			const filename = template
				? path.resolve(template.replace(path.extname(template), ext))
				: path.join(import.meta.dirname, `templates/${syntax}${ext}`)
			;
			if (fs.existsSync(filename)) {
				return {
					filename: filename,
					template: fs.readFileSync(filename, 'utf8')
				};
			}
			else if (!optional) {
				return grunt.fail.fatal(`Cannot find template at path: ${filename}`);
			}
		}

		/**
		 * Render template with error reporting
		 *
		 * @param {object} template {filename: 'Template filename', template: 'Template code'}
		 * @param {object} context Template context
		 * @return {string}
		 */
		function renderTemplate(template, context) {
			try {
				const func = _.template(template.template);
				return func(context);
			}
			catch (e) {
				grunt.fail.fatal(`Error while rendering template ${template.filename}: ${e.message}`);
			}
		}

		/**
		 * Basic template function: replaces {variables}
		 *
		 * @param {string} tmpl Template code
		 * @param {object} context Values object
		 * @return {string}
		 */
		function template(tmpl, context) {
			return tmpl.replace(/\{([^\}]+)\}/g, (m, key) => {
				return context[key];
			});
		}

		/**
		 * Prepare string to use as CSS class name
		 *
		 * @param {string} str
		 * @return {string}
		 */
		function classnameize(str) {
			return str.trim().replace(/\s+/g, '-');
		}

		/**
		 * Return path of CSS file.
		 *
		 * @param {string} stylesheet (css, scss, ...)
		 * @return {string}
		 */
		function getCssFilePath(stylesheet) {
			const cssFilePrefix = option(wf.cssFilePrefixes, stylesheet);
			return path.join(option(o.destCssPaths, stylesheet), `${cssFilePrefix}${o.fontBaseName}.${stylesheet}`);
		}

		/**
		 * Return path of HTML demo file or `null` if its generation was disabled.
		 *
		 * @return {string}
		 */
		function getDemoFilePath() {
			if (!o.htmlDemo) return null;
			const name = o.htmlDemoFilename || o.fontBaseName;
			return path.join(o.destHtml, `${name}.html`);
		}

		/**
		 * Return path of HTML demo file or `null` if feature was disabled
		 */
		function getDemoPath() {
			if (!o.htmlDemo) return null;
			return o.destHtml;
		}

		/**
		 * Save hash to cache file.
		 *
		 * @param {string} name Task name (webfont).
		 * @param {string} target Task target name.
		 * @param {string} hash Hash.
		 */
		function saveHash(name, target, hash) {
			const filepath = getHashPath(name, target);
			fs.mkdirSync(path.dirname(filepath), { recursive: true });
			fs.writeFileSync(filepath, hash);
		}

		/**
		 * Read hash from cache file or `null` if file don’t exist.
		 *
		 * @param {string} name Task name (webfont).
		 * @param {string} target Task target name.
		 * @return {string}
		 */
		function readHash(name, target) {
			const filepath = getHashPath(name, target);
			if (fs.existsSync(filepath)) {
				return fs.readFileSync(filepath, 'utf8');
			}
			return null;
		}

		/**
		 * Return path to cache file.
		 *
		 * @param {string} name Task name (webfont).
		 * @param {string} target Task target name.
		 * @return {string}
		 */
		function getHashPath(name, target) {
			return path.join(o.cache, name, target, 'hash');
		}
	});
};
