/**
 * SVG to webfont converter for Grunt
 *
 * @requires ttfautohint
 * @author Artem Sapegin (http://sapegin.me), Hibi_10000
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { globSync } from 'glob';
import chalk from 'chalk';
import _ from 'lodash';
import ttf2woff2 from 'ttf2woff2';
import fontforge from './engines/fontforge.ts';
import node from './engines/node.ts';
import * as wf from './util/util.ts';

import packageJson from '../package.json' with { type: "json" };

export default (grunt: IGrunt): void => {
	grunt.registerMultiTask('webfont', 'Compile separate SVG files to webfont', function() {
		/**
		 * Consola to Grunt logger adapter.
		 */
		const logger: Logger = {
			log: {
				warn: (...args) => {
					grunt.log.warn.apply(null, args);
				},
				error: (...args) => {
					grunt.warn.apply(null, args);
				},
				info: (...args) => {
					grunt.log.writeln.apply(null, args);
				},
				verbose: (...args) => {
					grunt.log.verbose.writeln.apply(null, args);
				},
			},
			fail: {
				fatal: (...args) => {
					grunt.fail.fatal.apply(null, args);
				},
			},
		};

		const allDone = this.async();
		const params = this.data;
		const options = this.options<Options>(undefined);

		/*
		 * Check for `src` param on target config
		 */
		this.requiresConfig([this.name, this.target, 'src'].join('.'));

		webfont(this.name, this.target, this.filesSrc, params, options, logger).finally(allDone);
	});
};

export const webfont = async (name: string, target: string, filesSrc: string[], params: Config, options: Options, logger?: Logger): Promise<void> => {
	if (!logger) logger = wf.consolaLogger;
	const md5 = crypto.createHash('md5');

	/*
	 * Check for `dest` param on either target config or global options object
	 */
	if ((params.dest === undefined) && (options.dest === undefined)) {
		logger.log.warn(`Required property ${name}.${target}.dest or ${name}.${target}.options.dest missing.`);
	}

	if (options.skip) {
		completeTask();
		return;
	}

	// Source files
	const files = filesSrc.filter(isSvgFile)
	if (!files.length) {
		logger.log.warn('Specified empty list of source SVG files.');
		completeTask();
		return;
	}

	// path must be a string, see https://nodejs.org/api/path.html#path_path_extname_path
	if (typeof options.template !== 'string') {
		options.template = '';
	}

	// Options
	let o: OptionsInternal = {
		logger: logger,
		fontBaseName: options.font || 'icons',
		destCss: options.destCss || params.destCss || params.dest,
		destScss: options.destScss || params.destScss || params.destCss || params.dest,
		destSass: options.destSass || params.destSass || params.destCss || params.dest,
		destLess: options.destLess || params.destLess || params.destCss || params.dest,
		destStyl: options.destStyl || params.destStyl || params.destCss || params.dest,
		dest: options.dest || params.dest,
		relativeFontPath: options.relativeFontPath,
		fontPathVariables: options.fontPathVariables || false,
		addHashes: options.hashes !== false,
		addLigatures: options.ligatures === true,
		template: options.template,
		syntax: options.syntax || 'bem',
		templateOptions: options.templateOptions || {},
		stylesheets: options.stylesheets || [options.stylesheet || path.extname(options.template).replace(/^\./, '') || 'css'],
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
		execMaxBuffer: options.execMaxBuffer || 1024 * 200,
	};

	o = Object.assign<OptionsInternal, Partial<OptionsInternal>>(o, {
		fontName: o.fontBaseName,
		destCssPaths: {
			css: o.destCss,
			scss: o.destScss,
			sass: o.destSass,
			less: o.destLess,
			styl: o.destStyl
		},
		relativeFontPath: o.relativeFontPath || path.relative(o.destCss, o.dest),
		destHtml: options.destHtml || o.destCss,
		fontfaceStyles: has(o.styles, 'font'),
		baseStyles: has(o.styles, 'icon'),
		extraStyles: has(o.styles, 'extra'),
		files: files,
		glyphs: [],
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
	const previousHash = readHash(name, target);
	logger.log.verbose('New hash:', o.hash, '- previous hash:', previousHash);
	if (o.hash === previousHash) {
		logger.log.verbose('Config and source files weren’t changed since last run, checking resulting files...');
		let regenerationNeeded = false;

		const generatedFiles = wf.generatedFontFiles(o);
		if (!generatedFiles.length){
			regenerationNeeded = true;
		} else {
			generatedFiles.push(getDemoFilePath());
			o.stylesheets.forEach((stylesheet) => {
				generatedFiles.push(getCssFilePath(stylesheet));
			});

			regenerationNeeded = generatedFiles.some((filename) => {
				if (!filename) return false;
				if (!fs.existsSync(filename)) {
					logger.log.verbose('File', filename, ' is missed.');
					return true;
				}
				return false;
			});
		}
		if (!regenerationNeeded) {
			logger.log.info(`Font ${chalk.cyan(o.fontName)} wasn’t changed since last run.`);
			completeTask();
			return;
		}
	}

	// Save new hash and run
	saveHash(name, target, o.hash);
	try {
		createOutputDirs();
		cleanOutputDir();
		await generateFont();
		generateWoff2Font();
		generateStylesheets();
		await generateDemoHtml();
		generateCustomOutputs();
		printDone();
	} finally {
		completeTask();
	}

	/**
	 * Call callback function if it was specified in the options.
	 */
	function completeTask(): void {
		if (o && ((typeof o.callback) === 'function')) {
			o.callback(o.fontName, o.types, o.glyphs, o.hash);
		}
	}

	/**
	 * Calculate hash to flush browser cache.
	 * Hash is based on source SVG files contents, task options and grunt-webfont version.
	 */
	function getHash(): string {
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
	function createOutputDirs(): void {
		o.stylesheets.forEach((stylesheet) => {
			fs.mkdirSync(option(o.destCssPaths, stylesheet), { recursive: true });
		});
		fs.mkdirSync(o.dest, { recursive: true });
	}

	/**
	 * Clean output directory
	 */
	function cleanOutputDir(): void {
		const htmlDemoFileMask = path.posix.join(o.destCss, `${o.fontBaseName}*.{css,html}`);
		const files = globSync(htmlDemoFileMask).concat(wf.generatedFontFiles(o));
		files.forEach(file => {
			fs.unlinkSync(file);
		});
	}

	/**
	 * Generate font using selected engine
	 */
	async function generateFont(): Promise<void> {
		const f = o.engine === 'node' ? node : fontforge;
		const result = await f(o);
		if (result === false) {
			// Font was not created, exit
			completeTask();
			return;
		}

		if (result) {
			o = Object.assign(o, result);
		}
	}

	/**
	 * Converts TTF font to WOFF2.
	 */
	function generateWoff2Font(): void {
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
	function generateStylesheets(): void {
		// Convert codepoints to array of strings
		const codepoints: string[] = [];
		o.glyphs.forEach((name) => {
			codepoints.push(o.codepoints[name].toString(16));
		});
		//@ts-ignore
		o.codepoints = codepoints;

		// Prepage glyph names to use as CSS classes
		o.glyphs = o.glyphs.map(classnameize);

		o.stylesheets.sort((a, b) => {
			return a === 'css' ? 1 : -1;
		}).forEach(generateStylesheet);
	}

	/**
	 * Generate CSS
	 *
	 * @param stylesheet type: css, scss, ...
	 */
	function generateStylesheet(stylesheet: string): void {
		o.relativeFontPath = normalizePath(o.relativeFontPath);

		// Generate font URLs to use in @font-face
		const fontSrcs: { 0: string[], 1: string[] } = { 0: [], 1: [] };
		o.order.forEach((type: 'eot'|'woff2'|'woff'|'ttf'|'svg') => {
			if (!has(o.types, type)) return;
			const fontSrc1 = wf.fontsSrcsMap[type][0];
			if (fontSrc1) fontSrcs[0].push(generateFontSrc(type, fontSrc1, stylesheet));
			fontSrcs[1].push(generateFontSrc(type, wf.fontsSrcsMap[type][1], stylesheet));
		});

		// Convert urls to strings that could be used in CSS
		const fontSrcSeparator = option(wf.fontSrcSeparators, stylesheet);
		o.fontSrc1 = fontSrcs[0].join(fontSrcSeparator);
		o.fontSrc2 = fontSrcs[1].join(fontSrcSeparator);
		o.fontRawSrcs = [fontSrcs[0], fontSrcs[1]];

		// Read JSON file corresponding to CSS template
		const templateJson = readTemplate(o.template, o.syntax, '.json', true);
		if (templateJson) o = Object.assign<OptionsInternal, Required<TemplateOptions>>(o, JSON.parse(templateJson.template));

		// Now override values with templateOptions
		if (o.templateOptions) o = Object.assign(o, o.templateOptions);

		// Generate CSS
		const ext = path.extname(o.template) || '.css'; // Use extension of o.template file if given, or default to .css
		o.cssTemplate = readTemplate(o.template, o.syntax, ext);
		const cssContext = Object.assign<OptionsInternal, Partial<Context>>(o, {
			iconsStyles: true,
			stylesheet: stylesheet,
		});

		let css = renderTemplate(o.cssTemplate, cssContext);

		// Fix CSS preprocessors comments: single line comments will be removed after compilation
		if (has(['sass', 'scss', 'less', 'styl'], stylesheet)) {
			css = css.replace(/\/\* *(.*?) *\*\//g, '// $1');
		}

		// Save file
		fs.writeFileSync(getCssFilePath(stylesheet), css);
	}

	/**
	 * Gets the codepoints from the set filepath in o.codepointsFile
	 */
	function readCodepointsFromFile(): { [key: string]: number } {
		if (!o.codepointsFile) return {};
		if (!fs.existsSync(o.codepointsFile)){
			logger.log.verbose('Codepoints file not found');
			return {};
		}

		const buffer = fs.readFileSync(o.codepointsFile);
		return JSON.parse(buffer.toString());
	}

	/**
	 * Saves the codespoints to the set file
	 */
	function saveCodepointsToFile(): void {
		if (!o.codepointsFile) return;
		const codepointsToString = JSON.stringify(o.codepoints, null, 4);
		try {
			fs.writeFileSync(o.codepointsFile, codepointsToString);
			logger.log.verbose(`Codepoints saved to file "${o.codepointsFile}".`);
		} catch (err) {
			logger.log.error(err.message);
		}
	}

	/*
	 * Prepares base context for templates
	 */
	function prepareBaseTemplateContext(): Context {
		const context = Object.assign<{}, Context>({}, o);
		return context;
	}

	/*
	 * Makes custom extends necessary for use with preparing the template context
	 * object for the HTML demo.
	 */
	function prepareHtmlTemplateContext(): Context {

		let context = prepareBaseTemplateContext();

		let htmlStyles;

		// Prepare relative font paths for injection into @font-face refs in HTML
		const relativeRe = new RegExp(_.escapeRegExp(o.relativeFontPath).replace(/[=!:\/]/g, '\\$&'), 'g');
		const htmlRelativeFontPath = normalizePath(path.relative(o.destHtml, o.dest));
		const _fontSrc1 = o.fontSrc1.replace(relativeRe, htmlRelativeFontPath);
		const _fontSrc2 = o.fontSrc2.replace(relativeRe, htmlRelativeFontPath);

		context = Object.assign<Context, Partial<Context>>(context, {
			fontSrc1: _fontSrc1,
			fontSrc2: _fontSrc2,
			fontfaceStyles: true,
			baseStyles: true,
			extraStyles: false,
			iconsStyles: true,
			stylesheet: 'css',
		});

		// Prepares CSS for injection into <style> tag at to of HTML
		htmlStyles = renderTemplate(o.cssTemplate, context);
		context = Object.assign<Context, Partial<Context>>(context, {
			styles: htmlStyles,
		});

		return context;
	}

	/**
	 * Iterator function used as callback by looping construct below to
	 * render "custom output" via mini configuration objects specified in
	 * the array `options.customOutputs`.
	 *
	 * @param outputConfig
	 */
	function generateCustomOutput(outputConfig: CustomOutput): void {

		// Accesses context
		let context = prepareBaseTemplateContext();
		context = Object.assign(context, outputConfig.context);

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
		} else {
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
	function generateCustomOutputs(): void {
		if (!o.customOutputs || o.customOutputs.length < 1) {
			return;
		}

		o.customOutputs.forEach(generateCustomOutput);
	}

	/**
	 * Generate HTML demo page
	 */
	async function generateDemoHtml(): Promise<void> {
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
				logger.log.info(err);
				return;
			}
		}
		// Save file
		fs.writeFileSync(getDemoFilePath(), demo);

	}

	/**
	 * Print log
	 */
	function printDone(): void {
		logger.log.info(`Font ${chalk.cyan(o.fontName)} with ${o.glyphs.length} glyphs created.`);
	}


	/**
	 * Helpers
	 */

	/**
	 * Convert a string of comma separated words into an array
	 *
	 * @param val Input string
	 * @param defVal Default value
	 */
	function optionToArray(val: string | false, defVal: string | false): string[] {
		if (val === undefined) {
			val = defVal;
		}
		if (!val) {
			return [];
		}
		if (typeof val !== 'string') {
			return val;
		}
		return val.split(',').map((value) => value.trim());
	}

	/**
	 * Check if a value exists in an array
	 *
	 * @param haystack Array to find the needle in
	 * @param needle Value to find
	 * @return Needle was found
	 */
	function has(haystack: string[] | string, needle: string): boolean {
		return haystack.indexOf(needle) !== -1;
	}

	/**
	 * Return a specified option if it exists in an object or `_default` otherwise
	 *
	 * @param map Options object
	 * @param key Option to find in the object
	 */
	function option(map: { _default?: string, [key: string]: string }, key: string): string {
		if (key in map) {
			return map[key];
		} else {
			return map._default;
		}
	}

	/**
	 * Find next unused codepoint.
	 */
	function getNextCodepoint(): number {
		while (Object.values(o.codepoints).includes(currentCodepoint)) {
			currentCodepoint++;
		}
		return currentCodepoint;
	}

	/**
	 * Check whether file is SVG or not
	 *
	 * @param filepath File path
	 */
	function isSvgFile(filepath: string): boolean {
		return path.extname(filepath).toLowerCase() === '.svg';
	}

	/**
	 * Convert font file to data:uri and remove source file
	 *
	 * @param fontFile Font file path
	 * @return Base64 encoded string
	 */
	function embedFont(fontFile: string): string {
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
	 * @param filepath File path
	 */
	function normalizePath(filepath: string): string {
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
	 * @param type Type of font
	 * @param font URL or Base64 string
	 * @param stylesheet type: css, scss, ...
	 */
	function generateFontSrc(type: string, font: { ext: string, format?: string, embeddable?: boolean }, stylesheet: string): string {
		const filename = template(`${o.fontFilename}${font.ext}`, o);
		let fontPathVariableName = `${o.fontFamilyName}-font-path`;

		let url;
		if (font.embeddable && has(o.embed, type)) {
			url = embedFont(path.join(o.dest, filename));
		} else {
			if (o.fontPathVariables &&  stylesheet !== 'css') {
				if (stylesheet === 'less') {
					fontPathVariableName = `@${fontPathVariableName}`;
					o.fontPathVariable = `${fontPathVariableName} : "${o.relativeFontPath}";`;
				}
				else {
					fontPathVariableName = `$${fontPathVariableName}`;
					o.fontPathVariable = `${fontPathVariableName} : "${o.relativeFontPath}" !default;`;
				}
				url = filename;
			}
			else {
				url = `${o.relativeFontPath}${filename}`;
			}
			if (o.addHashes) {
				if (url.indexOf('#iefix') === -1) { // Do not add hashes for OldIE
					// Put hash at the end of an URL or before #hash
					url = url.replace(/(#|$)/, `?${o.hash}$1`);
				} else {
					url = url.replace(/(#|$)/, `${o.hash}$1`);
				}
			}
		}

		let src = `url("${url}")`;
		if (o.fontPathVariables && stylesheet !== 'css') {
			if (stylesheet === 'less') {
				src = `url("@{${fontPathVariableName.replace('@','')}}${url}")`;
			}
			else {
				src = `url(${fontPathVariableName} + "${url}")`;
			}
		}

		if (font.format) src += ` format("${font.format}")`;

		return src;
	}

	/**
	 * Read the template file
	 *
	 * @param template Template file path
	 * @param syntax Syntax (bem, bootstrap, etc.)
	 * @param ext Extension of the template
	 * @return \{filename: 'Template filename', template: 'Template code'}
	 */
	function readTemplate(template: string, syntax: string, ext: string, optional?: boolean): { filename: string, template: string } {
		const filename = template
			? path.resolve(template.replace(path.extname(template), ext))
			: path.join(import.meta.dirname, `../templates/${syntax}${ext}`)
		;
		if (fs.existsSync(filename)) {
			return {
				filename: filename,
				template: fs.readFileSync(filename, 'utf8'),
			};
		} else if (!optional) {
			logger.fail.fatal(`Cannot find template at path: ${filename}`);
		}
	}

	/**
	 * Render template with error reporting
	 *
	 * @param template {filename: 'Template filename', template: 'Template code'}
	 * @param context Template context
	 */
	function renderTemplate(template: { filename: string, template: string }, context: Context): string {
		try {
			const func = _.template(template.template);
			return func(context);
		} catch (e) {
			logger.fail.fatal(`Error while rendering template ${template.filename}: ${e.message}`);
		}
	}

	/**
	 * Basic template function: replaces {variables}
	 *
	 * @param tmpl Template code
	 * @param context Values object
	 */
	function template(tmpl: string, context: OptionsInternal): string {
		return tmpl.replace(/\{([^\}]+)\}/g, (m, key: keyof OptionsInternal) => {
			return context[key] as string;
		});
	}

	/**
	 * Prepare string to use as CSS class name
	 *
	 * @param str
	 */
	function classnameize(str: string): string {
		return str.trim().replace(/\s+/g, '-');
	}

	/**
	 * Return path of CSS file.
	 *
	 * @param stylesheet (css, scss, ...)
	 */
	function getCssFilePath(stylesheet: string): string {
		const cssFilePrefix = option(wf.cssFilePrefixes, stylesheet);
		return path.join(option(o.destCssPaths, stylesheet), `${cssFilePrefix}${o.fontBaseName}.${stylesheet}`);
	}

	/**
	 * Return path of HTML demo file or `null` if its generation was disabled.
	 */
	function getDemoFilePath(): string {
		if (!o.htmlDemo) return null;
		const name = o.htmlDemoFilename || o.fontBaseName;
		return path.join(o.destHtml, `${name}.html`);
	}

	/**
	 * Return path of HTML demo file or `null` if feature was disabled
	 */
	function getDemoPath(): string {
		if (!o.htmlDemo) return null;
		return o.destHtml;
	}

	/**
	 * Save hash to cache file.
	 *
	 * @param name Task name (webfont).
	 * @param target Task target name.
	 * @param hash Hash.
	 */
	function saveHash(name: string, target: string, hash: string): void {
		const filepath = getHashPath(name, target);
		fs.mkdirSync(path.dirname(filepath), { recursive: true });
		fs.writeFileSync(filepath, hash);
	}

	/**
	 * Read hash from cache file or `null` if file don’t exist.
	 *
	 * @param name Task name (webfont).
	 * @param target Task target name.
	 */
	function readHash(name: string, target: string): string {
		const filepath = getHashPath(name, target);
		if (fs.existsSync(filepath)) {
			return fs.readFileSync(filepath, 'utf8');
		}
		return null;
	}

	/**
	 * Return path to cache file.
	 *
	 * @param name Task name (webfont).
	 * @param target Task target name.
	 */
	function getHashPath(name: string, target: string): string {
		return path.join(o.cache, name, target, 'hash');
	}
};
