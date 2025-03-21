/**
 * grunt-webfont: fontforge engine
 *
 * @requires fontforge, ttfautohint 1.00+ (optional), eotlitetool.py
 * @author Artem Sapegin (http://sapegin.me)
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import temp from 'temp';
import chalk from 'chalk';
import _ from 'lodash';
import winston from 'winston';
import * as wf from '../util/util.js';

/** @type {(o: object, allDone: (result: { fontName: string } | false) => void) => void} */
export default (o, allDone) => {
	const logger = o.logger || winston;

	// Copy source files to temporary directory
	const tempDir = temp.mkdirSync();
	o.files.forEach((file) => {
		fs.writeFileSync(path.join(tempDir, o.rename(file)), fs.readFileSync(file));
	});

	// Run Fontforge
	const args = [
		'fontforge',
		'-script',
		'"' + path.join(import.meta.dirname, 'fontforge/generate.py') + '"'
	].join(' ');

	const proc = exec(args, { maxBuffer: o.execMaxBuffer }, (err, out, code) => {
		if (err instanceof Error && err.code === 127) {
			return fontforgeNotFound();
		}
		else if (err) {
			if (err instanceof Error) {
				return error(err.message);
			}

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
				return error(warn.join('\n'));
			}
		}

		// Trim fontforge result
		const json = out.replace(/^[^{]+/, '').replace(/[^}]+$/, '');

		// Parse json
		let result;
		try {
			result = JSON.parse(json);
		}
		catch (e) {
			logger.verbose('Webfont did not receive a proper JSON result from Python script: ' + e);
			return error(
				'Something went wrong when running fontforge. Probably fontforge wasn’t installed correctly or one of your SVGs is too complicated for fontforge.\n\n' +
				'1. Try to run Grunt in verbose mode: ' + chalk.bold('grunt --verbose webfont') + ' and see what fontforge says. Then search GitHub issues for the solution: ' + chalk.underline('https://github.com/sapegin/grunt-webfont/issues') + '.\n\n' +
				'2. Try to use “node” engine instead of “fontforge”: ' + chalk.underline('https://github.com/sapegin/grunt-webfont#engine') + '\n\n' +
				'3. To find “bad” icon try to remove SVGs one by one until error disappears. Then try to simplify this SVG in Sketch, Illustrator, etc.\n\n'
			);
		}

		allDone({
			fontName: path.basename(result.file)
		});
	});

	// Send JSON with params
	if (!proc) return;
	proc.stdin.on('error', (err) => {
		if (err.code === 'EPIPE') {
			fontforgeNotFound();
		}
	});

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
				"1. Try to run grunt in verbose mode to see fontforge output: " + chalk.bold('grunt --verbose webfont') + ".\n" +
				"2. If stderr maxBuffer exceeded try to increase " + chalk.bold('execMaxBuffer') + ", see " +
					chalk.underline('https://github.com/sapegin/grunt-webfont#execMaxBuffer') + ". "
			);
		}
		return true;
	});

	const params = _.extend(o, {
		inputDir: tempDir
	});
	proc.stdin.write(JSON.stringify(params));
	proc.stdin.end();

	function error() {
		logger.error.apply(null, arguments);
		allDone(false);
		return false;
	}

	const fontforgeNotFound = () => {
		error('fontforge not found. Please install fontforge and all other requirements: ' + chalk.underline('https://github.com/sapegin/grunt-webfont#installation'));
	}

};
