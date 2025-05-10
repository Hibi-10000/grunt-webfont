/**
 * grunt-webfont: fontforge engine
 *
 * @requires fontforge, ttfautohint 1.00+ (optional), eotlitetool.py
 * @author Artem Sapegin (http://sapegin.me)
 */

import fs from 'node:fs';
import path from 'node:path';
import util from 'node:util';
import { exec } from 'node:child_process';
import temp from 'temp';
import chalk from 'chalk';
import _ from 'lodash';
import * as wf from '../util/util.js';

/** @type {(o: OptionsInternal) => Promise<{ fontName: string } | false>} */
export default async (o) => {
	const logger = o.logger || wf.consolaLogger;

	// Copy source files to temporary directory
	temp.track();
	const tempDir = temp.mkdirSync();
	o.files.forEach((file) => {
		fs.writeFileSync(path.join(tempDir, o.rename(file)), fs.readFileSync(file));
	});

	// Run Fontforge
	const args = [
		'fontforge',
		'-script',
		`"${path.join(import.meta.dirname, 'fontforge/generate.py')}"`
	].join(' ');

	const execPromise = util.promisify(exec);
	const promise = execPromise(args, { maxBuffer: o.execMaxBuffer });
	const proc = promise.child;

	// Send JSON with params
	if (!proc) throw new TypeError('process is null');

	proc.stderr.on('data', (data) => {
		logger.log.verbose(data);
	});
	proc.stdout.on('data', (data) => {
		logger.log.verbose(data);
	});
	proc.on('exit', (code, signal) => {
		if (code !== 0) {
			logger.log.info( // cannot use error() because it will stop execution of callback of exec (which shows error message)
				"fontforge process has unexpectedly closed.\n" +
				`1. Try to run grunt in verbose mode to see fontforge output: ${chalk.bold('grunt --verbose webfont')}.\n` +
				`2. If stderr maxBuffer exceeded try to increase ${chalk.bold('execMaxBuffer')}, ` +
				`see ${chalk.underline('https://github.com/sapegin/grunt-webfont#execMaxBuffer')}. `
			);
		}
	});

	const params = Object.assign(o, {
		inputDir: tempDir
	});
	proc.stdin.write(JSON.stringify(params));
	proc.stdin.end();

	let out;
	try {
		out = (await promise).stdout;
	} catch (err) {
		/** @typedef {import('node:child_process').ExecException} ExecException */
		if (err instanceof Error && (/** @type {ExecException} */(err)).code === 127) {
			logger.log.error(`fontforge not found. Please install fontforge and all other requirements: ${chalk.underline('https://github.com/sapegin/grunt-webfont#installation')}`);
			return false;
		}
		if (err instanceof Error) {
			logger.log.error(err.message);
			return false;
		}
		logger.log.error(`probably an impossible error`);

		// Skip some fontforge output such as copyrights. Show warnings only when no font files was created
		// or in verbose mode.
		const success = !!wf.generatedFontFiles(o);
		const notError = /(Copyright|License |with many parts BSD |Executable based on sources from|Library based on sources from|Based on source from git)/;
		//const version = /(Executable based on sources from|Library based on sources from)/;
		const lines = (/** @type {string} */(err)).split('\n');

		/** @type {string[]} */
		const warn = [];
		lines.forEach((line) => {
			if (!line.match(notError) && !success) {
				warn.push(line);
			} else {
				logger.log.verbose(chalk.grey('fontforge: ') + line);
			}
		});

		if (warn.length) {
			logger.log.error(warn.join('\n'));
			return false;
		}
		logger.log.error(`impossible error: ${err}`);
		return false;
	}

	// Trim fontforge result
	const json = out.replace(/^[^{]+/, '').replace(/[^}]+$/, '');

	// Parse json
	/** @type {{ file: string }} */
	let result;
	try {
		result = JSON.parse(json);
	} catch (e) {
		logger.log.verbose(`Webfont did not receive a proper JSON result from Python script: ${e}`);
		logger.log.error(
			'Something went wrong when running fontforge. Probably fontforge wasn’t installed correctly or one of your SVGs is too complicated for fontforge.\n\n' +
			`1. Try to run Grunt in verbose mode: ${chalk.bold('grunt --verbose webfont')} and see what fontforge says. Then search GitHub issues for the solution: ${chalk.underline('https://github.com/sapegin/grunt-webfont/issues')}.\n\n` +
			`2. Try to use “node” engine instead of “fontforge”: ${chalk.underline('https://github.com/sapegin/grunt-webfont#engine')}\n\n` +
			'3. To find “bad” icon try to remove SVGs one by one until error disappears. Then try to simplify this SVG in Sketch, Illustrator, etc.\n\n'
		);
		return false;
	}

	return {
		fontName: path.basename(result.file)
	};
};
