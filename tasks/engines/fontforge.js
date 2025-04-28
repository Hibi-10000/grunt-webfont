/**
 * grunt-webfont: fontforge engine
 *
 * @requires fontforge, ttfautohint 1.00+ (optional), eotlitetool.py
 * @author Artem Sapegin (http://sapegin.me)
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import util from 'node:util';
import { exec } from 'node:child_process';
import temp from 'temp';
import chalk from 'chalk';
import _ from 'lodash';
import winston from 'winston';
import * as wf from '../util/util.js';

/** @type {(o: OptionsInternal, allDone: (result: { fontName: string } | false) => void) => void} */
export default (o, allDone) => {
	const logger = o.logger || winston;

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
	if (!proc) return;

	proc.stderr.on('data', (data) => {
		logger.verbose(data);
	});
	proc.stdout.on('data', (data) => {
		logger.verbose(data);
	});
	proc.on('exit', (code, signal) => {
		if (code !== 0) {
			logger.log( // cannot use error() because it will stop execution of callback of exec (which shows error message)
				"fontforge process has unexpectedly closed.\n" +
				`1. Try to run grunt in verbose mode to see fontforge output: ${chalk.bold('grunt --verbose webfont')}.\n` +
				`2. If stderr maxBuffer exceeded try to increase ${chalk.bold('execMaxBuffer')}, ` +
				`see ${chalk.underline('https://github.com/sapegin/grunt-webfont#execMaxBuffer')}. `
			);
		}
	});

	const params = _.extend(o, {
		inputDir: tempDir
	});
	proc.stdin.write(JSON.stringify(params));
	proc.stdin.end();

	(async () => {
		let out;
		try {
			out = (await promise).stdout;
		} catch (err) {
			/** @typedef {import('node:child_process').ExecException} ExecException */
			if (err instanceof Error && (/** @type {ExecException} */(err)).code === 127) {
				fontforgeNotFound();
				allDone(false);
				return;
			}
			if (err instanceof Error) {
				error(err.message);
				allDone(false);
				return;
			}
			logger.error(`probably an impossible error`);

			// Skip some fontforge output such as copyrights. Show warnings only when no font files was created
			// or in verbose mode.
			const success = !!wf.generatedFontFiles(o);
			const notError = /(Copyright|License |with many parts BSD |Executable based on sources from|Library based on sources from|Based on source from git)/;
			//const version = /(Executable based on sources from|Library based on sources from)/;
			const lines = err.split('\n');

			const warn = [];
			lines.forEach((line) => {
				if (!line.match(notError) && !success) {
					warn.push(line);
				}
				else {
					logger.verbose(chalk.grey('fontforge: ') + line);
				}
			});

			if (warn.length) {
				error(warn.join('\n'));
				allDone(false);
				return;
			}
			error(`impossible error: ${err}`);
			allDone(false);
			return;
		}

		// Trim fontforge result
		const json = out.replace(/^[^{]+/, '').replace(/[^}]+$/, '');

		// Parse json
		let result;
		try {
			result = JSON.parse(json);
		}
		catch (e) {
			logger.verbose(`Webfont did not receive a proper JSON result from Python script: ${e}`);
			error(
				'Something went wrong when running fontforge. Probably fontforge wasn’t installed correctly or one of your SVGs is too complicated for fontforge.\n\n' +
				`1. Try to run Grunt in verbose mode: ${chalk.bold('grunt --verbose webfont')} and see what fontforge says. Then search GitHub issues for the solution: ${chalk.underline('https://github.com/sapegin/grunt-webfont/issues')}.\n\n` +
				`2. Try to use “node” engine instead of “fontforge”: ${chalk.underline('https://github.com/sapegin/grunt-webfont#engine')}\n\n` +
				'3. To find “bad” icon try to remove SVGs one by one until error disappears. Then try to simplify this SVG in Sketch, Illustrator, etc.\n\n'
			);
			allDone(false);
			return;
		}

		allDone({
			fontName: path.basename(result.file)
		});
	})();

	const error = (/** @type {any[]} */...args) => {
		logger.error.apply(null, args);
	}

	const fontforgeNotFound = () => {
		error(`fontforge not found. Please install fontforge and all other requirements: ${chalk.underline('https://github.com/sapegin/grunt-webfont#installation')}`);
	}

};
