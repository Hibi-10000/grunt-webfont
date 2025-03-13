'use strict';

import fs from 'node:fs';
import path from 'node:path';
import grunt from 'grunt';
import { parseString as parseXMLString } from 'xml2js';
import wf from '../tasks/util/util.js';

function find(haystack, needle) {
	return haystack.indexOf(needle) !== -1;
}

function findDuplicates(haystack, needles) {
	var sorted_arr = haystack.sort();

	var results = [];
	for (var i = 0; i < haystack.length - 1; i++) {
		if (sorted_arr[i + 1] === sorted_arr[i]) {
			results.push(sorted_arr[i]);
		}
	}

	return results;
}

export const webfont = {
	test1: function(test) {
		// All out files should be created and should not be empty
		'ttf'.split(',').forEach(function(type) {
			var name = type.toUpperCase();
			test.ok(fs.existsSync('test/tmp/test1/icons.' + type), name + ' file created.');
			test.ok(grunt.file.read('test/tmp/test1/icons.' + type).length, name + ' file not empty.');
		});

		'css,html'.split(',').forEach(function(type) {
			var name = type.toUpperCase();
			test.ok(fs.existsSync('test/tmp/test1/icons.' + type), name + ' file created.');
			test.ok(grunt.file.read('test/tmp/test1/icons.' + type).length, name + ' file not empty.');
		});

		var svgs = grunt.file.expand('test/src/**.*');
		var css = grunt.file.read('test/tmp/test1/icons.css');
		var html = grunt.file.read('test/tmp/test1/icons.html');

		// CSS links to font files are correct
		'ttf'.split(',').forEach(function(type) {
			test.ok(
				find(css, 'url("icons.' + type),
				'File path ' + type + ' should be in CSS file.'
			);
		});

		// Every SVG file should have corresponding entry in CSS and HTML files
		svgs.forEach(function(file, index) {
			var id = path.basename(file, '.svg');
			test.ok(
				find(css, '.icon_' + id + ':before'),
				'Icon ' + id + ' should be in CSS file.'
			);
			test.ok(
				find(css, 'content:"\\' + (wf.UNICODE_PUA_START + index).toString(16) + '"'),
				'Character at index ' + index + ' has its codepoint in the CSS'
			);
			test.ok(
				find(html, '<div class="icons__item" data-name="' + id + '"><i class="icon icon_' + id + '"></i> icon_' + id + '</div>'),
				'Icon ' + id + ' should be in HTML file.'
			);
		});

		test.done();
	},

	embed: function(test) {
		// All out files should be created and should not be empty
		'ttf'.split(',').forEach(function(type) {
			var name = type.toUpperCase(),
				prefix = 'test/tmp/embed/icons.';
			test.ok(fs.existsSync(prefix + type), name + ' file created.');
			test.ok(grunt.file.read(prefix + type).length, name + ' file not empty.');
		});

		// WOFF should be deleted
		'woff'.split(',').forEach(function(type) {
			var name = type.toUpperCase(),
				prefix = 'test/tmp/embed/icons.';
			test.ok(!fs.existsSync(prefix + type), name + ' file NOT created.');
		});

		test.done();
	},

	embed_ttf: function(test) {
		// Excluded file types should not be created + TTF should be deleted
		'ttf'.split(',').forEach(function(type) {
			var name = type.toUpperCase(),
				prefix = 'test/tmp/embed_ttf/icons.';
			test.ok(!fs.existsSync(prefix + type), name + ' file NOT created.');
		});

		var css = grunt.file.read('test/tmp/embed_ttf/icons.css');
		var m;

		// Data:uri
		m = css.match(/data:application\/x-font-ttf;charset=utf-8;base64,.*?format\("truetype"\)/g);
		test.equal(m && m.length, 1, 'TrueType data:uri');

		test.done();
	},

	one: function(test) {
		// All out files should be created and should not be empty
		'ttf'.split(',').forEach(function(type) {
			var name = type.toUpperCase();
			test.ok(fs.existsSync('test/tmp/one/icons.' + type), name + ' file created.');
			test.ok(grunt.file.read('test/tmp/one/icons.' + type).length, name + ' file not empty.');
		});

		'css,html'.split(',').forEach(function(type) {
			var name = type.toUpperCase();
			test.ok(fs.existsSync('test/tmp/one/icons.' + type), name + ' file created.');
			test.ok(grunt.file.read('test/tmp/one/icons.' + type).length, name + ' file not empty.');
		});

		var svgs = grunt.file.expand('test/src_one/**.*'),
			css = grunt.file.read('test/tmp/one/icons.css');

		// CSS links to font files are correct
		'ttf'.split(',').forEach(function(type) {
			test.ok(
				find(css, 'icons.' + type),
				'File path ' + type + ' should be in CSS file.'
			);
		});

		// Every SVG file should have corresponding entry in CSS file
		svgs.forEach(function(file) {
			var id = path.basename(file, '.svg');
			test.ok(
				find(css, '.icon_' + id + ':before'),
				'Icon ' + id + ' should be in CSS file.'
			);
		});

		test.done();
	},

	template: function(test) {
		var css = grunt.file.read('test/tmp/template/icons.css');

		// There should be comment from custom template
		test.ok(
			find(css, 'Custom template'),
			'Comment from custom template.'
		);

		test.done();
	},

	enabled_template_variables: function(test) {
		var htmlFilename = 'test/tmp/enabled_template_variables/icons.html';

		var html = grunt.file.read(htmlFilename);

		// The LESS variable should not be included in the html demo source
		test.ok(
			!find(html, 'url("@{icons-font-path}icons'),
			'Path variables were found in the HTML demo.'
		);

		test.done();
	},

	html_template: function(test) {
		var demo = grunt.file.read('test/tmp/html_template/icons.html');

		// There should be comment from custom template
		test.ok(
			find(demo, 'Custom template'),
			'Comment from custom template.'
		);

		test.done();
	},

	html_filename: function(test) {
		var htmlfile = 'test/tmp/html_filename/index.html';

		// There should be comment from custom template
		test.ok(fs.existsSync(htmlfile), 'HTML demo file custom name created.');

		test.done();
	},

	relative_path: function(test) {
		var css = grunt.file.read('test/tmp/relative_path/icons.css');

		// CSS links to font files are correct
		'ttf'.split(',').forEach(function(type) {
			test.ok(
				find(css, 'url("../iamrelative/icons.' + type),
				'File path ' + type + ' should be in CSS file.'
			);
		});

		test.done();
	},

	spaces: function(test) {
		var css = grunt.file.read('test/tmp/spaces/icons.css');

		test.ok(
			find(css, '.icon_ma-il-ru:before'),
			'Spaces in class name should be replaced by hyphens.'
		);
		test.ok(
			find(css, 'content:"\\' + wf.UNICODE_PUA_START.toString(16) + '";'),
			'Right codepoint should exists.'
		);

		test.done();
	},

	disable_demo: function(test) {
		test.ok(fs.existsSync('test/tmp/disable_demo/icons.css'), 'CSS file created.');
		test.ok(!fs.existsSync('test/tmp/disable_demo/icons.html'), 'HTML file not created.');

		test.done();
	},

	parent_source: function(test) {
		var svgs = grunt.file.expand('test/src/**.*');
		var css = grunt.file.read('test/tmp/parent_source/icons.css');

		// Every SVG file should have corresponding entry in CSS file
		svgs.forEach(function(file) {
			var id = path.basename(file, '.svg');
			test.ok(
				find(css, '.icon_' + id + ':before'),
				'Icon ' + id + ' should be in CSS file.'
			);
		});

		test.done();
	},

	ligatures: function(test) {
		var svgs = grunt.file.expand('test/ligatures_src/**.*');
		var css = grunt.file.read('test/tmp/ligatures/icons.css');

		// Every SVG file should have corresponding entry in CSS file
		svgs.forEach(function(file) {
			var name = path.basename(file, '.svg');
			test.ok(
				find(css, 'content:"'+name+'";'),
				'Icon ' + name + ' should be in CSS file.'
			);
		});

		test.done();
	},

	duplicate_names: function(test) {
		var svgs = grunt.file.expand('test/src_duplicate_names/**/*.svg');
		var css = grunt.file.read('test/tmp/duplicate_names/icons.css');

		// Every SVG file should have corresponding entry in CSS file
		svgs.forEach(function(file) {
			var id = [path.basename(path.dirname(file)), path.basename(file, '.svg')].join('-');
			test.ok(
				find(css, '.icon_' + id + ':before'),
				'Icon ' + id + ' should be in CSS file.'
			);
		});

		test.done();
	},

	ie7: function(test){
		var css = grunt.file.read('test/tmp/ie7/icons.css');
		var svgs = grunt.file.expand('test/src/*.svg');
		test.ok(find(css, '*zoom'), '*zoom property should be set');
		test.ok(find(css, '&#x') , 'HTML char are present');
		svgs.forEach(function(file){
			var id = path.basename(file, '.svg');
			test.ok(
				find(css, '.icon_' + id + ' {'),
				'Icon ' + id + ' shound be in CSS file.'
			);
		});
		test.done();
	},

	ie7_bootstrap: function(test){
		var css = grunt.file.read('test/tmp/ie7_bootstrap/icons.css');
		var svgs = grunt.file.expand('test/src/*.svg');
		test.ok(find(css, '*zoom'), '*zoom property should be set');
		test.ok(find(css, '&#x') , 'HTML char are present');
		svgs.forEach(function(file){
			var id = path.basename(file, '.svg');
			test.ok(
				find(css, '.icon-' + id + ' {'),
				'Icon ' + id + ' shound be in CSS file.'
			);
		});
		test.done();
	},

	codepoints: function(test) {
		// Default codepoint of 0xE001 can be overidden
		var resultSVG = grunt.file.expand('test/tmp/codepoints/icons.svg');
		var css = grunt.file.read('test/tmp/codepoints/icons.css');
		var html = grunt.file.read('test/tmp/codepoints/icons.html');
		var startCodepoint = 0x41;

		// Generated SVG font should have glyphs at the overidden codepoints
		resultSVG.forEach(function(file) {
			var svgSource = grunt.file.read(file);
			var glyphs = [];

			parseXMLString(svgSource, function(err, result) {
				// Normalise glyphs into JS objects
				result.svg.defs[0].font[0].glyph.forEach(function(glyph) {
					if (glyph.$['glyph-name'].length === 1) {  // Skip non-characters (.notdef, .null, etc.)
						glyphs.push(glyph.$);
					}
				});

				// Two assertions for each glyph:
				// - each glyph has a unique unicode character
				// - the correct glyph character code is present in the generated CSS
				var unicodeCharArr = glyphs.map(function(g) { return g.unicode; });
				for (var index = 0; index < glyphs.length; index ++) {
					test.equals(0, findDuplicates(unicodeCharArr).length);
					test.ok(
						find(css, 'content:"\\' + (startCodepoint + index).toString(16) + '"'),
						'Character at index ' + index + ' has its codepoint in the CSS'
					);
				}
			});
		});

		test.done();
	},

	camel: function(test) {
		var svgs = grunt.file.expand('test/camel/*.svg');
		var css = grunt.file.read('test/tmp/camel/icons.css');

		// Every SVG file should have corresponding entries in CSS file in the same case
		svgs.forEach(function(file) {
			var id = path.basename(file, '.svg');
			test.ok(
				find(css, '.icon_' + id + ':before'),
				'Icon ' + id + ' should be in CSS file.'
			);
		});

		test.done();
	},

	folders: function(test) {
		// @todo Temporarily disabled because different fontforge versions produce different paths
		test.done();
		if (true) return;

		var svgFont = grunt.file.read('test/tmp/folders/icons.svg');
		var paths = JSON.parse(grunt.file.read('test/src_folders/paths.json'));
		var glyphs = [];
		parseXMLString(svgFont, function(err, result) {
			// Normalise glyphs into JS objects
			result.svg.defs[0].font[0].glyph.forEach(function(glyph) {
				if (/^uni/.test(glyph.$['glyph-name'])) {  // Skip non-characters (.notdef, .null, etc.)
					glyphs.push(glyph.$);
				}
			});

			glyphs.forEach(function(glyph) {
				test.equals(glyph.d, paths[glyph['glyph-name']], 'Glyph with codepoint ' + glyph.unicode + ' has correct path.');
			});
		});

		test.done();
	},

	target_overrides: function(test) {

		var css = grunt.file.read('test/tmp/target_overrides_css/icons.css');
		test.ok(fs.existsSync('test/tmp/target_overrides_css/icons.css') + ' file created.');

		test.done();
	},

	font_family_name: function(test) {
		var html = grunt.file.read('test/tmp/font_family_name/icons.html');

		// fontFamilyName should be in the HTML file's title
		test.ok(
			find(html, '<title>customName</title>'),
			'fontFamilyName should be in the HTML file title'
		);

		// File should still have default name if only fontFamilyName is specified
		test.ok(fs.existsSync('test/tmp/font_family_name/icons.ttf'));

		test.done();
	},

	custom_outputs: function(test) {

		// File should have been created when filename is specified
		test.ok(fs.existsSync('test/tmp/custom_output/test-icon-config.js'));

		// File should have been created (with template basename) when filename is not specified
		test.ok(fs.existsSync('test/tmp/custom_output/custom.json'));

		// Files should render with custom context variables
		test.ok(fs.existsSync('test/tmp/custom_output/context-test.html'));

		test.done();
	},

};
