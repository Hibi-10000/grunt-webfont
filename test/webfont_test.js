import fs from 'node:fs';
import path from 'node:path';
import grunt from 'grunt';
import stylus from 'stylus';
import { parseString as parseXMLString } from 'xml2js';
import * as wf from '../tasks/util/util.js';

/** @type {(haystack: string, needle: string) => boolean} */
function find(haystack, needle) {
	return haystack.indexOf(needle) !== -1;
}

/** @type {(haystack: string[], needles?: never) => string[]} */
function findDuplicates(haystack, needles) {
	const sorted_arr = haystack.sort();

	/** @type {string[]} */
	const results = [];
	for (let i = 0; i < haystack.length - 1; i++) {
		if (sorted_arr[i + 1] === sorted_arr[i]) {
			results.push(sorted_arr[i]);
		}
	}

	return results;
}

/** @type {{ [key: string]: (test: import('nodeunit').Test) => void }} */
export const webfont = {
	test1: (test) => {
		// All out files should be created and should not be empty
		'woff,ttf,eot'.split(',').forEach((type) => {
			const name = type.toUpperCase();
			test.ok(fs.existsSync(`test/tmp/test1/icons.${type}`), `${name} file created.`);
			test.ok(grunt.file.read(`test/tmp/test1/icons.${type}`).length, `${name} file not empty.`);
		});

		'css,html'.split(',').forEach((type) => {
			const name = type.toUpperCase();
			test.ok(fs.existsSync(`test/tmp/test1/icons.${type}`), `${name} file created.`);
			test.ok(grunt.file.read(`test/tmp/test1/icons.${type}`).length, `${name} file not empty.`);
		});

		const svgs = grunt.file.expand('test/src/**.*');
		const css = grunt.file.read('test/tmp/test1/icons.css');
		const html = grunt.file.read('test/tmp/test1/icons.html');

		// CSS links to font files are correct
		'woff,ttf,eot'.split(',').forEach((type) => {
			test.ok(
				find(css, `url("icons.${type}`),
				`File path ${type} should be in CSS file.`
			);
		});

		// Double EOT (for IE9 compat mode)
		test.ok(
			find(css, 'src:url("icons.eot");'),
			'First EOT declaration.'
		);
		test.ok(
			find(css, 'src:url("icons.eot?#iefix") format("embedded-opentype"),'),
			'Second EOT declaration.'
		);

		// Every SVG file should have corresponding entry in CSS and HTML files
		svgs.forEach((file, index) => {
			const id = path.basename(file, '.svg');
			test.ok(
				find(css, `.icon_${id}:before`),
				`Icon ${id} should be in CSS file.`
			);
			test.ok(
				find(css, `content:"\\${(wf.UNICODE_PUA_START + index).toString(16)}"`),
				`Character at index ${index} has its codepoint in the CSS`
			);
			test.ok(
				find(html, `<div class="icons__item" data-name="${id}"><i class="icon icon_${id}"></i> icon_${id}</div>`),
				`Icon ${id} should be in HTML file.`
			);
		});

		test.done();
	},

	test2: (test) => {
		const css = grunt.file.read('test/tmp/test2/myfont.css');

		// Read hash
		const hashes = css.match(/url\("fonts\/myfont\.woff\?([0-9a-f]{32})"\)/);
		const hash = hashes && hashes[1];
		test.ok(hash, 'Hash calculated.');

		// All out files should be created and should not be empty
		'woff,svg'.split(',').forEach((type) => {
			const name = type.toUpperCase();
			const prefix = 'test/tmp/test2/fonts/myfont.';
			test.ok(fs.existsSync(prefix + type), `${name} file created.`);
			test.ok(grunt.file.read(prefix + type).length, `${name} file not empty.`);
		});
		'css,html'.split(',').forEach((type) => {
			const name = type.toUpperCase();
			test.ok(fs.existsSync(`test/tmp/test2/myfont.${type}`), `${name} file created.`);
			test.ok(grunt.file.read(`test/tmp/test2/myfont.${type}`).length, `${name} file not empty.`);
		});

		// Excluded file types should not be created
		'eot,ttf'.split(',').forEach((type) => {
			const name = type.toUpperCase();
			const prefix = 'test/tmp/test2/fonts/myfont.';
			test.ok(!fs.existsSync(prefix + type), `${name} file NOT created.`);
		});

		const svgs = grunt.file.expand('test/src/**.*');
		const html = grunt.file.read('test/tmp/test2/myfont.html');

		// CSS links to font files are correct
		'woff,svg'.split(',').forEach((type) => {
			test.ok(
				find(css, `url("fonts/myfont.${type}?${hash}`),
				`File path ${type} should be in CSS file.`
			);
		});

		// CSS links to excluded formats should not be included
		'ttf,eot'.split(',').forEach((type) => {
			test.ok(
				!find(css, `fonts/myfont.${type}`),
				`File path ${type} should be in CSS file.`
			);
		});


		// Every SVG file should have corresponding entry in CSS and HTML files
		svgs.forEach((file) => {
			const id = path.basename(file, '.svg');
			test.ok(
				find(css, `.icon-${id}:before`),
				`Icon ${id} should be in CSS file.`
			);
			test.ok(
				find(html, `<div class="icons__item" data-name="${id}"><i class=" icon-${id}"></i> icon-${id}</div>`),
				`Icon ${id} should be in HTML file.`
			);
		});

		test.done();
	},

	embed: (test) => {
		// All out files should be created and should not be empty
		'ttf,eot'.split(',').forEach((type) => {
			const name = type.toUpperCase();
			const prefix = 'test/tmp/embed/icons.';
			test.ok(fs.existsSync(prefix + type), `${name} file created.`);
			test.ok(grunt.file.read(prefix + type).length, `${name} file not empty.`);
		});

		// WOFF should be deleted
		'woff'.split(',').forEach((type) => {
			const name = type.toUpperCase();
			const prefix = 'test/tmp/embed/icons.';
			test.ok(!fs.existsSync(prefix + type), `${name} file NOT created.`);
		});

		const css = grunt.file.read('test/tmp/embed/icons.css');

		// Data:uri
		const m = css.match(/data:application\/x-font-woff;charset=utf-8;base64,.*?format\("woff"\)/g);
		test.equal(m && m.length, 1, 'WOFF (default) data:uri');

		test.done();
	},

	embed_woff: (test) => {
		// Excluded file types should not be created + WOFF should be deleted
		'woff,ttf,eot'.split(',').forEach((type) => {
			const name = type.toUpperCase();
			const prefix = 'test/tmp/embed_woff/icons.';
			test.ok(!fs.existsSync(prefix + type), `${name} file NOT created.`);
		});

		const css = grunt.file.read('test/tmp/embed_woff/icons.css');
		let m;

		// Data:uri
		m = css.match(/data:application\/x-font-woff;charset=utf-8;base64,.*?format\("woff"\)/g);
		test.equal(m && m.length, 1, 'Data:uri');

		test.done();
	},

	embed_ttf: (test) => {
		// Excluded file types should not be created + TTF should be deleted
		'woff,ttf,eot'.split(',').forEach((type) => {
			const name = type.toUpperCase();
			const prefix = 'test/tmp/embed_ttf/icons.';
			test.ok(!fs.existsSync(prefix + type), `${name} file NOT created.`);
		});

		const css = grunt.file.read('test/tmp/embed_ttf/icons.css');
		let m;

		// Data:uri
		m = css.match(/data:application\/x-font-ttf;charset=utf-8;base64,.*?format\("truetype"\)/g);
		test.equal(m && m.length, 1, 'TrueType data:uri');

		test.done();
	},

	embed_ttf_woff: (test) => {
		// Excluded file types should not be created + TTF should be deleted
		'woff,ttf,eot'.split(',').forEach((type) => {
			const name = type.toUpperCase();
			const prefix = 'test/tmp/embed_ttf_woff/icons.';
			test.ok(!fs.existsSync(prefix + type), `${name} file NOT created.`);
		});

		const css = grunt.file.read('test/tmp/embed_ttf_woff/icons.css');
		let m;

		// Data:uri
		m = css.match(/data:application\/x-font-ttf;charset=utf-8;base64,.*?format\("truetype"\)/g);
		test.equal(m && m.length, 1, 'TrueType data:uri');
		m = css.match(/data:application\/x-font-woff;charset=utf-8;base64,.*?format\("woff"\)/g);
		test.equal(m && m.length, 1, 'WOFF data:uri');

		test.done();
	},

	one: (test) => {
		// All out files should be created and should not be empty
		'woff,ttf,eot'.split(',').forEach((type) => {
			const name = type.toUpperCase();
			test.ok(fs.existsSync(`test/tmp/one/icons.${type}`), `${name} file created.`);
			test.ok(grunt.file.read(`test/tmp/one/icons.${type}`).length, `${name} file not empty.`);
		});

		'css,html'.split(',').forEach((type) => {
			const name = type.toUpperCase();
			test.ok(fs.existsSync(`test/tmp/one/icons.${type}`), `${name} file created.`);
			test.ok(grunt.file.read(`test/tmp/one/icons.${type}`).length, `${name} file not empty.`);
		});

		const svgs = grunt.file.expand('test/src_one/**.*');
		const css = grunt.file.read('test/tmp/one/icons.css');

		// CSS links to font files are correct
		'woff,ttf,eot'.split(',').forEach((type) => {
			test.ok(
				find(css, `icons.${type}`),
				`File path ${type} should be in CSS file.`
			);
		});

		// Every SVG file should have corresponding entry in CSS file
		svgs.forEach((file) => {
			const id = path.basename(file, '.svg');
			test.ok(
				find(css, `.icon_${id}:before`),
				`Icon ${id} should be in CSS file.`
			);
		});

		test.done();
	},

	template: (test) => {
		const css = grunt.file.read('test/tmp/template/icons.css');

		// There should be comment from custom template
		test.ok(
			find(css, 'Custom template'),
			'Comment from custom template.'
		);

		test.done();
	},

	template_scss: (test) => {
		const cssFilename = 'test/tmp/template_scss/_icons.scss';

		test.ok(fs.existsSync(cssFilename), 'SCSS template: .scss file created.');

		const css = grunt.file.read(cssFilename);

		// There should be comment from custom template
		test.ok(
			find(css, 'Custom template'),
			'SCSS template: comment from custom template.'
		);

		test.done();
	},

	template_sass: (test) => {
		const cssFilename = 'test/tmp/template_sass/_icons.sass';

		test.ok(fs.existsSync(cssFilename), 'SASS template: .sass file created (stylesheet extension derived from template name).');

		const css = grunt.file.read(cssFilename);

		// There should be comment from custom template
		test.ok(
			find(css, 'Custom template'),
			'SASS template: comment from custom template.'
		);

		test.done();
	},

	enabled_template_variables: (test) => {
		const scssFilename = 'test/tmp/enabled_template_variables/_icons.scss';
		const lessFilename = 'test/tmp/enabled_template_variables/icons.less';
		const htmlFilename = 'test/tmp/enabled_template_variables/icons.html';

		const scss = grunt.file.read(scssFilename);
		const less = grunt.file.read(lessFilename);
		const html = grunt.file.read(htmlFilename);

		// There should be a variable declaration for scss preprocessor
		test.ok(
			find(scss, '$icons-font-path : "../iamrelative/" !default;'),
			'SCSS enable template variables: variable exists.'
		);

		// There should be a variable declaration for scss preprocessor
		test.ok(
			find(scss, '$icons-font-path : "../iamrelative/" !default;'),
			'SCSS enable template variables: variable exists.'
		);

		// There should be a variable declaration for less preprocessor
		test.ok(
			find(less, '@icons-font-path : "../iamrelative/";'),
			'LESS enable template variables: variable exists.'
		);

		// The variable should be used in the less file
		test.ok(
			find(less, 'url("@{icons-font-path}icons'),
			'LESS enable template variables: variable used.'
		);

		// The LESS variable should not be included in the html demo source
		test.ok(
			!find(html, 'url("@{icons-font-path}icons'),
			'Path variables were found in the HTML demo.'
		);

		test.done();
	},

	html_template: (test) => {
		const demo = grunt.file.read('test/tmp/html_template/icons.html');

		// There should be comment from custom template
		test.ok(
			find(demo, 'Custom template'),
			'Comment from custom template.'
		);

		test.done();
	},

	html_filename: (test) => {
		const htmlfile = 'test/tmp/html_filename/index.html';

		// There should be comment from custom template
		test.ok(fs.existsSync(htmlfile), 'HTML demo file custom name created.');

		test.done();
	},

	relative_path: (test) => {
		const css = grunt.file.read('test/tmp/relative_path/icons.css');

		// CSS links to font files are correct
		'woff,ttf,eot'.split(',').forEach((type) => {
			test.ok(
				find(css, `url("../iamrelative/icons.${type}`),
				`File path ${type} should be in CSS file.`
			);
		});

		test.done();
	},

	sass: (test) => {
		test.ok(fs.existsSync('test/tmp/sass/_icons.sass'), 'SASS file with underscore created.');
		test.ok(!fs.existsSync('test/tmp/sass/icons.sass'), 'SASS file without underscore not created.');
		test.ok(!fs.existsSync('test/tmp/sass/icons.css'), 'CSS file not created.');

		//const svgs = grunt.file.expand('test/src/**.*');
		const sass = grunt.file.read('test/tmp/sass/_icons.sass');

		// There should be comment from custom template
		let m = sass.match(/\/\* *(.*?) *\*\//g);
		test.ok(!m, 'No regular CSS comments.');

		// There should be comment from custom template
		m = sass.match(/^\/\//gm);
		test.equal(m && m.length, 2, 'Single line comments.');

		test.done();
	},

	less: (test) => {
		test.ok(fs.existsSync('test/tmp/less/icons.less'), 'LESS file created.');
		test.ok(!fs.existsSync('test/tmp/less/icons.css'), 'CSS file not created.');

		const svgs = grunt.file.expand('test/src/**.*');
		const less = grunt.file.read('test/tmp/less/icons.less');

		// There should be comment from custom template
		let m = less.match(/\/\* *(.*?) *\*\//g);
		test.ok(!m, 'No regular CSS comments.');

		// There should be comment from custom template
		m = less.match(/^\/\//gm);
		test.equal(m && m.length, 2, 'Single line comments.');

		// Every SVG file should have two corresponding entries in CSS file
		svgs.forEach((file) => {
			const id = path.basename(file, '.svg');
			test.ok(
				find(less, `.icon_${id} {\n\t&:before`),
				`LESS Mixin ${id} should be in CSS file.`
			);
		});

		test.done();
	},

	css_plus_scss: (test) => {
		test.ok(fs.existsSync('test/tmp/scss/_icons.scss'), 'SCSS file with underscore created.');
		test.ok(!fs.existsSync('test/tmp/scss/icons.scss'), 'SCSS file without underscore not created.');
		test.ok(fs.existsSync('test/tmp/css/icons.css'), 'CSS file is created.');

		test.done();
	},

	stylus_bem: (test) => {
		test.ok(fs.existsSync('test/tmp/stylus_bem/icons.styl'), 'Stylus file created.');
		test.ok(!fs.existsSync('test/tmp/stylus_bem/icons.css'), 'CSS file not created.');

		const styl = grunt.file.read('test/tmp/stylus_bem/icons.styl');

		// There should be comment from custom template
		let m = styl.match(/\/\* *(.*?) *\*\//g);
		test.ok(!m, 'No regular CSS comments.');

		// There should be comment from custom template
		m = styl.match(/^\/\//gm);
		test.equal(m && m.length, 2, 'Single line comments.');

		const s = stylus(styl);

		s.render((err, css) => {
			if (err) {
				console.log('Stylus compile error:');
				console.log(err);
			}
			test.ok(!err, 'Stylus file compiled.');
			test.done();
		});
	},

	stylus_bootstrap: (test) => {
		test.ok(fs.existsSync('test/tmp/stylus_bootstrap/icons.styl'), 'Stylus file created.');
		test.ok(!fs.existsSync('test/tmp/stylus_bootstrap/icons.css'), 'CSS file not created.');

		const styl = grunt.file.read('test/tmp/stylus_bootstrap/icons.styl');

		const s = stylus(styl);

		s.render((err, css) => {
			if (err) {
				console.log('Stylus compile error:');
				console.log(err);
			}
			test.ok(!err, 'Stylus file compiled.');
			test.done();
		});
	},

	spaces: (test) => {
		const css = grunt.file.read('test/tmp/spaces/icons.css');

		test.ok(
			find(css, '.icon_ma-il-ru:before'),
			'Spaces in class name should be replaced by hyphens.'
		);
		test.ok(
			find(css, `content:"\\${wf.UNICODE_PUA_START.toString(16)}";`),
			'Right codepoint should exists.'
		);

		test.done();
	},

	disable_demo: (test) => {
		test.ok(fs.existsSync('test/tmp/disable_demo/icons.css'), 'CSS file created.');
		test.ok(!fs.existsSync('test/tmp/disable_demo/icons.html'), 'HTML file not created.');

		test.done();
	},

	non_css_demo: (test) => {
		test.ok(!fs.existsSync('test/tmp/non_css_demo/icons.css'), 'CSS file not created.');
		test.ok(fs.existsSync('test/tmp/non_css_demo/icons.html'), 'HTML file created.');

		const html = grunt.file.read('test/tmp/non_css_demo/icons.html');

		test.ok(
			find(html, '@font-face {'),
			'Font-face declaration exists in HTML.'
		);

		test.ok(
			find(html, '.icon {'),
			'Base icon exists in HTML.'
		);

		test.ok(
			!find(html, 'url("../iamrelative/icons-'),
			'Relative paths should not be in HTML.'
		);

		test.ok(
			!find(html, '&:before'),
			'LESS mixins should not be in HTML.'
		);

		// Every SVG file should have corresponding entry in <style> block
		const svgs = grunt.file.expand('test/src/**.*');
		svgs.forEach((file) => {
			const id = path.basename(file, '.svg');
			test.ok(
				find(html, `.icon_${id}:before`),
				`Icon ${id} CSS should be in HTML file.`
			);
		});

		test.done();
	},

	parent_source: (test) => {
		const svgs = grunt.file.expand('test/src/**.*');
		const css = grunt.file.read('test/tmp/parent_source/icons.css');

		// Every SVG file should have corresponding entry in CSS file
		svgs.forEach((file) => {
			const id = path.basename(file, '.svg');
			test.ok(
				find(css, `.icon_${id}:before`),
				`Icon ${id} should be in CSS file.`
			);
		});

		test.done();
	},

	ligatures: (test) => {
		const svgs = grunt.file.expand('test/ligatures_src/**.*');
		const css = grunt.file.read('test/tmp/ligatures/icons.css');

		// Every SVG file should have corresponding entry in CSS file
		svgs.forEach((file) => {
			const name = path.basename(file, '.svg');
			test.ok(
				find(css, `content:"${name}";`),
				`Icon ${name} should be in CSS file.`
			);
		});

		test.done();
	},

	duplicate_names: (test) => {
		const svgs = grunt.file.expand('test/src_duplicate_names/**/*.svg');
		const css = grunt.file.read('test/tmp/duplicate_names/icons.css');

		// Every SVG file should have corresponding entry in CSS file
		svgs.forEach((file) => {
			const id = [path.basename(path.dirname(file)), path.basename(file, '.svg')].join('-');
			test.ok(
				find(css, `.icon_${id}:before`),
				`Icon ${id} should be in CSS file.`
			);
		});

		test.done();
	},

	order: (test) => {
		//const svgs = grunt.file.expand('test/src/**.*');
		const css = grunt.file.read('test/tmp/order/icons.css');

		// Font-face src rules should be in right order
		test.ok(
			find(css, 'src:url("icons.svg#icons") format("svg"),\n\t\turl("icons.woff") format("woff");'),
			'Font-face src rules should be in right order.'
		);

		test.done();
	},

	template_options: (test) => {
		const svgs = grunt.file.expand('test/src/**.*');
		const less = grunt.file.read('test/tmp/template_options/icons.less');
		const html = grunt.file.read('test/tmp/template_options/icons.html');

		test.ok(
			find(less, '.glyph-icon {'),
			'Class .glyph-icon should be in LESS file.'
		);

		// Every SVG file should have corresponding entry in LESS and HTML files
		svgs.forEach((file) => {
			const id = path.basename(file, '.svg');
			// test.ok(
			// 		find(less, `.make-icon-${id} {`),
			// 		`Mixin .make-icon-${id} should be in LESS file.`
			// );
			test.ok(
				find(less, `.glyph_${id} {`),
				`Icon .glyph_${id} should be in LESS file.`
			);
			test.ok(
				find(html, `<div class="icons__item" data-name="${id}"><i class="glyph-icon glyph_${id}"></i> glyph_${id}</div>`),
				`Icon .glyph_${id} should be in HTML file.`
			);
		});

		test.done();
	},

	node: (test) => {
		// All out files should be created and should not be empty
		'woff,ttf,eot'.split(',').forEach((type) => {
			const name = type.toUpperCase();
			test.ok(fs.existsSync(`test/tmp/node/icons.${type}`), `${name} file created.`);
			test.ok(grunt.file.read(`test/tmp/node/icons.${type}`).length, `${name} file not empty.`);
		});

		'css,html'.split(',').forEach((type) => {
			const name = type.toUpperCase();
			test.ok(fs.existsSync(`test/tmp/node/icons.${type}`), `${name} file created.`);
			test.ok(grunt.file.read(`test/tmp/node/icons.${type}`).length, `${name} file not empty.`);
		});

		const svgs = grunt.file.expand('test/src/**.*');
		const css = grunt.file.read('test/tmp/node/icons.css');
		const html = grunt.file.read('test/tmp/node/icons.html');

		// CSS links to font files are correct
		'woff,ttf,eot'.split(',').forEach((type) => {
			test.ok(
				find(css, `url("icons.${type}`),
				`File path ${type} shound be in CSS file.`
			);
		});

		// Double EOT (for IE9 compat mode)
		test.ok(
			find(css, 'src:url("icons.eot");'),
			'First EOT declaration.'
		);
		test.ok(
			find(css, 'src:url("icons.eot?#iefix") format("embedded-opentype"),'),
			'Second EOT declaration.'
		);

		// Every SVG file should have corresponding entry in CSS and HTML files
		svgs.forEach((file) => {
			const id = path.basename(file, '.svg');
			test.ok(
				find(css, `.icon_${id}:before`),
				`Icon ${id} shound be in CSS file.`
			);
			test.ok(
				find(html, `<div class="icons__item" data-name="${id}"><i class="icon icon_${id}"></i> icon_${id}</div>`),
				`Icon ${id} shound be in HTML file.`
			);
		});

		test.done();
	},

	ie7: (test) => {
		const css = grunt.file.read('test/tmp/ie7/icons.css');
		const svgs = grunt.file.expand('test/src/*.svg');
		test.ok(find(css, '*zoom'), '*zoom property should be set');
		test.ok(find(css, '&#x') , 'HTML char are present');
		svgs.forEach((file) => {
			const id = path.basename(file, '.svg');
			test.ok(
				find(css, `.icon_${id} {`),
				`Icon ${id} shound be in CSS file.`
			);
		});
		test.done();
	},

	ie7_bootstrap: (test) => {
		const css = grunt.file.read('test/tmp/ie7_bootstrap/icons.css');
		const svgs = grunt.file.expand('test/src/*.svg');
		test.ok(find(css, '*zoom'), '*zoom property should be set');
		test.ok(find(css, '&#x') , 'HTML char are present');
		svgs.forEach((file) => {
			const id = path.basename(file, '.svg');
			test.ok(
				find(css, `.icon-${id} {`),
				`Icon ${id} shound be in CSS file.`
			);
		});
		test.done();
	},

	optimize_enabled: (test) => {
		const optimizedPathSegment = '280.2V280.098C349.867 293.072 358.595';
		const svg = grunt.file.read('test/tmp/optimize_enabled/icons.svg');
		if(svg.indexOf(optimizedPathSegment) === -1) {
			test.fail(true, 'SVG element must be contains the optimized path', undefined, undefined);
		}
		test.done();
	},

	optimize_disabled: (test) => {
		const optimizedPathSegment = '280.2V280.098C349.867 293.072 358.595';
		const svg = grunt.file.read('test/tmp/optimize_disabled/icons.svg');
		if(svg.indexOf(optimizedPathSegment) > -1) {
			test.fail(true, 'SVG element must be contains the un-optimized path', undefined, undefined);
		}
		test.done();
	},

	codepoints: (test) => {
		// Default codepoint of 0xE001 can be overidden
		const resultSVG = grunt.file.expand('test/tmp/codepoints/icons.svg');
		const css = grunt.file.read('test/tmp/codepoints/icons.css');
		//const html = grunt.file.read('test/tmp/codepoints/icons.html');
		const startCodepoint = 0x41;

		// Generated SVG font should have glyphs at the overidden codepoints
		resultSVG.forEach((file) => {
			const svgSource = grunt.file.read(file);
			/** @type {{ unicode: string }[]} */
			const glyphs = [];

			parseXMLString(svgSource, (err, result) => {
				// Normalise glyphs into JS objects
				result.svg.defs[0].font[0].glyph.forEach((/** @type {{ $: { unicode: string, "glyph-name": string } }} */glyph) => {
					if (glyph.$['glyph-name'].length === 1) { // Skip non-characters (.notdef, .null, etc.)
						glyphs.push(glyph.$);
					}
				});

				// Two assertions for each glyph:
				// - each glyph has a unique unicode character
				// - the correct glyph character code is present in the generated CSS
				const unicodeCharArr = glyphs.map((g) => { return g.unicode; });
				for (let index = 0; index < glyphs.length; index++) {
					test.equals(0, findDuplicates(unicodeCharArr).length);
					test.ok(
						find(css, `content:"\\${(startCodepoint + index).toString(16)}"`),
						`Character at index ${index} has its codepoint in the CSS`
					);
				}
			});
		});

		test.done();
	},

	camel: (test) => {
		const svgs = grunt.file.expand('test/camel/*.svg');
		const css = grunt.file.read('test/tmp/camel/icons.css');

		// Every SVG file should have corresponding entries in CSS file in the same case
		svgs.forEach((file) => {
			const id = path.basename(file, '.svg');
			test.ok(
				find(css, `.icon_${id}:before`),
				`Icon ${id} should be in CSS file.`
			);
		});

		test.done();
	},

	folders: (test) => {
		// @todo Temporarily disabled because different fontforge versions produce different paths
		test.done();
		if (true) return;

		const svgFont = grunt.file.read('test/tmp/folders/icons.svg');
		const paths = JSON.parse(grunt.file.read('test/src_folders/paths.json'));
		/** @type {{ unicode: string, d: string, "glyph-name": string }[]} */
		const glyphs = [];
		parseXMLString(svgFont, (err, result) => {
			// Normalise glyphs into JS objects
			result.svg.defs[0].font[0].glyph.forEach((/** @type {{ $: { unicode: string, d: string, "glyph-name": string } }} */glyph) => {
				if (/^uni/.test(glyph.$['glyph-name'])) { // Skip non-characters (.notdef, .null, etc.)
					glyphs.push(glyph.$);
				}
			});

			glyphs.forEach((glyph) => {
				test.equals(glyph.d, paths[glyph['glyph-name']], `Glyph with codepoint ${glyph.unicode} has correct path.`);
			});
		});

		test.done();
	},

	woff2: (test) => {
		// All out files should be created and should not be empty
		'woff,woff2'.split(',').forEach((type) => {
			const name = type.toUpperCase();
			test.ok(fs.existsSync(`test/tmp/woff2/icons.${type}`), `${name} file created.`);
			test.ok(grunt.file.read(`test/tmp/woff2/icons.${type}`).length, `${name} file not empty.`);
		});

		// TTF file should be deleted
		'ttf'.split(',').forEach((type) => {
			test.ok(!fs.existsSync(`test/tmp/woff2/icons.${type}`), `${type.toUpperCase()} file NOT created.`);
		});

		'css,html'.split(',').forEach((type) => {
			const name = type.toUpperCase();
			test.ok(fs.existsSync(`test/tmp/woff2/icons.${type}`), `${name} file created.`);
			test.ok(grunt.file.read(`test/tmp/woff2/icons.${type}`).length, `${name} file not empty.`);
		});

		//const svgs = grunt.file.expand('test/src/**.*');
		const css = grunt.file.read('test/tmp/woff2/icons.css');
		//const html = grunt.file.read('test/tmp/woff2/icons.html');

		// CSS links to font files are correct
		'woff2,woff'.split(',').forEach((type) => {
			test.ok(
				find(css, `url("icons.${type}`),
				`File path ${type} shound be in CSS file.`
			);
		});

		// CSS links to TTF should not be created
		'ttf'.split(',').forEach((type) => {
			test.ok(
				!find(css, `url("icons.${type}`),
				`File path ${type} shound NOT be in CSS file.`
			);
		});

		test.done();
	},

	woff2_node: (test) => {
		// All out files should be created and should not be empty
		'woff,woff2'.split(',').forEach((type) => {
			const name = type.toUpperCase();
			test.ok(fs.existsSync(`test/tmp/woff2_node/icons.${type}`), `${name} file created.`);
			test.ok(grunt.file.read(`test/tmp/woff2_node/icons.${type}`).length, `${name} file not empty.`);
		});

		// TTF file should be deleted
		'ttf'.split(',').forEach((type) => {
			test.ok(!fs.existsSync(`test/tmp/woff2_node/icons.${type}`), `${type.toUpperCase()} file NOT created.`);
		});

		'css,html'.split(',').forEach((type) => {
			const name = type.toUpperCase();
			test.ok(fs.existsSync(`test/tmp/woff2_node/icons.${type}`), `${name} file created.`);
			test.ok(grunt.file.read(`test/tmp/woff2_node/icons.${type}`).length, `${name} file not empty.`);
		});

		//const svgs = grunt.file.expand('test/src/**.*');
		const css = grunt.file.read('test/tmp/woff2_node/icons.css');
		//const html = grunt.file.read('test/tmp/woff2_node/icons.html');

		// CSS links to font files are correct
		'woff2,woff'.split(',').forEach((type) => {
			test.ok(
				find(css, `url("icons.${type}`),
				`File path ${type} shound be in CSS file.`
			);
		});

		// CSS links to TTF should not be created
		'ttf'.split(',').forEach((type) => {
			test.ok(
				!find(css, `url("icons.${type}`),
				`File path ${type} shound NOT be in CSS file.`
			);
		});

		test.done();
	},

	target_overrides: (test) => {

		//const css = grunt.file.read('test/tmp/target_overrides_css/icons.css');
		test.ok(fs.existsSync('test/tmp/target_overrides_css/icons.css'), 'CSS file created.');

		'woff,ttf,eot'.split(',').forEach((type) => {
			const name = type.toUpperCase();
			test.ok(fs.existsSync(`test/tmp/target_overrides_icons/icons.${type}`), `${name} file created.`);
			test.ok(grunt.file.read(`test/tmp/target_overrides_icons/icons.${type}`).length, `${name} file not empty.`);
		});

		test.done();
	},

	font_family_name: (test) => {
		const html = grunt.file.read('test/tmp/font_family_name/icons.html');

		// fontFamilyName should be in the HTML file's title
		test.ok(
			find(html, '<title>customName</title>'),
			'fontFamilyName should be in the HTML file title'
		);

		// File should still have default name if only fontFamilyName is specified
		test.ok(fs.existsSync('test/tmp/font_family_name/icons.ttf'));

		test.done();
	},

	custom_outputs: (test) => {

		// File should have been created when filename is specified
		test.ok(fs.existsSync('test/tmp/custom_output/test-icon-config.js'));

		// File should have been created (with template basename) when filename is not specified
		test.ok(fs.existsSync('test/tmp/custom_output/custom.json'));

		// Files should render with custom context variables
		test.ok(fs.existsSync('test/tmp/custom_output/context-test.html'));

		test.done();
	},

	filename_length: (test) => {

		// File should have been created.
		test.ok(fs.existsSync('test/tmp/filename_length/icons.css'));

		// File should have been created.
		test.ok(fs.existsSync('test/tmp/filename_length/icons.woff'));

		// File should have been created.
		test.ok(fs.existsSync('test/tmp/filename_length/icons.html'));

		test.done();
	}

};
