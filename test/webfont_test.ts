import type { TestContextAssert } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { globSync } from 'glob';
import stylus from 'stylus';
import { parseString as parseXMLString } from 'xml2js';

import * as wf from '../tasks/util/util.ts';

function find(source: string, target: string): boolean {
	return source.indexOf(target) !== -1;
}

function findDuplicates(array: string[]): string[] {
	const sorted_arr = array.sort();

	const results: string[] = [];
	for (let i = 0; i < array.length - 1; i++) {
		if (sorted_arr[i + 1] === sorted_arr[i]) {
			results.push(sorted_arr[i]);
		}
	}

	return results;
}

export const webfont: Record<string, (test: TestContextAssert) => void | Promise<void>> = {
	test1: (test: TestContextAssert) => {
		// All out files should be created and should not be empty
		['woff', 'ttf', 'eot'].forEach((type) => {
			const name = type.toUpperCase();
			test.ok(fs.existsSync(`test/tmp/test1/icons.${type}`), `${name} file created.`);
			test.ok(fs.readFileSync(`test/tmp/test1/icons.${type}`, 'utf8').length, `${name} file not empty.`);
		});

		['css', 'html'].forEach((type) => {
			const name = type.toUpperCase();
			test.ok(fs.existsSync(`test/tmp/test1/icons.${type}`), `${name} file created.`);
			test.ok(fs.readFileSync(`test/tmp/test1/icons.${type}`, 'utf8').length, `${name} file not empty.`);
		});

		const svgs = globSync('test/src/**.*');
		const css = fs.readFileSync('test/tmp/test1/icons.css', 'utf8');
		const html = fs.readFileSync('test/tmp/test1/icons.html', 'utf8');

		// CSS links to font files are correct
		['woff', 'ttf', 'eot'].forEach((type) => {
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

	test2: (test: TestContextAssert) => {
		const css = fs.readFileSync('test/tmp/test2/myfont.css', 'utf8');

		// Read hash
		const hashes = css.match(/url\("fonts\/myfont\.woff\?([0-9a-f]{32})"\)/);
		const hash = hashes && hashes[1];
		test.ok(hash, 'Hash calculated.');

		// All out files should be created and should not be empty
		['woff', 'svg'].forEach((type) => {
			const name = type.toUpperCase();
			const prefix = 'test/tmp/test2/fonts/myfont.';
			test.ok(fs.existsSync(prefix + type), `${name} file created.`);
			test.ok(fs.readFileSync(prefix + type, 'utf8').length, `${name} file not empty.`);
		});
		['css', 'html'].forEach((type) => {
			const name = type.toUpperCase();
			test.ok(fs.existsSync(`test/tmp/test2/myfont.${type}`), `${name} file created.`);
			test.ok(fs.readFileSync(`test/tmp/test2/myfont.${type}`, 'utf8').length, `${name} file not empty.`);
		});

		// Excluded file types should not be created
		['eot', 'ttf'].forEach((type) => {
			const name = type.toUpperCase();
			const prefix = 'test/tmp/test2/fonts/myfont.';
			test.ok(!fs.existsSync(prefix + type), `${name} file NOT created.`);
		});

		const svgs = globSync('test/src/**.*');
		const html = fs.readFileSync('test/tmp/test2/myfont.html', 'utf8');

		// CSS links to font files are correct
		['woff', 'svg'].forEach((type) => {
			test.ok(
				find(css, `url("fonts/myfont.${type}?${hash}`),
				`File path ${type} should be in CSS file.`
			);
		});

		// CSS links to excluded formats should not be included
		['ttf', 'eot'].forEach((type) => {
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

	embed: (test: TestContextAssert) => {
		// All out files should be created and should not be empty
		['ttf', 'eot'].forEach((type) => {
			const name = type.toUpperCase();
			const prefix = 'test/tmp/embed/icons.';
			test.ok(fs.existsSync(prefix + type), `${name} file created.`);
			test.ok(fs.readFileSync(prefix + type, 'utf8').length, `${name} file not empty.`);
		});

		// WOFF should be deleted
		['woff'].forEach((type) => {
			const name = type.toUpperCase();
			const prefix = 'test/tmp/embed/icons.';
			test.ok(!fs.existsSync(prefix + type), `${name} file NOT created.`);
		});

		const css = fs.readFileSync('test/tmp/embed/icons.css', 'utf8');

		// Data:uri
		const m = css.match(/data:application\/x-font-woff;charset=utf-8;base64,.*?format\("woff"\)/g);
		test.equal(m && m.length, 1, 'WOFF (default) data:uri');

		test.done();
	},

	embed_woff: (test: TestContextAssert) => {
		// Excluded file types should not be created + WOFF should be deleted
		['woff', 'ttf', 'eot'].forEach((type) => {
			const name = type.toUpperCase();
			const prefix = 'test/tmp/embed_woff/icons.';
			test.ok(!fs.existsSync(prefix + type), `${name} file NOT created.`);
		});

		const css = fs.readFileSync('test/tmp/embed_woff/icons.css', 'utf8');
		let m: RegExpMatchArray;

		// Data:uri
		m = css.match(/data:application\/x-font-woff;charset=utf-8;base64,.*?format\("woff"\)/g);
		test.equal(m && m.length, 1, 'Data:uri');

		test.done();
	},

	embed_ttf: (test: TestContextAssert) => {
		// Excluded file types should not be created + TTF should be deleted
		['woff', 'ttf', 'eot'].forEach((type) => {
			const name = type.toUpperCase();
			const prefix = 'test/tmp/embed_ttf/icons.';
			test.ok(!fs.existsSync(prefix + type), `${name} file NOT created.`);
		});

		const css = fs.readFileSync('test/tmp/embed_ttf/icons.css', 'utf8');
		let m: RegExpMatchArray;

		// Data:uri
		m = css.match(/data:application\/x-font-ttf;charset=utf-8;base64,.*?format\("truetype"\)/g);
		test.equal(m && m.length, 1, 'TrueType data:uri');

		test.done();
	},

	embed_ttf_woff: (test: TestContextAssert) => {
		// Excluded file types should not be created + TTF should be deleted
		['woff', 'ttf', 'eot'].forEach((type) => {
			const name = type.toUpperCase();
			const prefix = 'test/tmp/embed_ttf_woff/icons.';
			test.ok(!fs.existsSync(prefix + type), `${name} file NOT created.`);
		});

		const css = fs.readFileSync('test/tmp/embed_ttf_woff/icons.css', 'utf8');
		let m: RegExpMatchArray;

		// Data:uri
		m = css.match(/data:application\/x-font-ttf;charset=utf-8;base64,.*?format\("truetype"\)/g);
		test.equal(m && m.length, 1, 'TrueType data:uri');
		m = css.match(/data:application\/x-font-woff;charset=utf-8;base64,.*?format\("woff"\)/g);
		test.equal(m && m.length, 1, 'WOFF data:uri');

		test.done();
	},

	one: (test: TestContextAssert) => {
		// All out files should be created and should not be empty
		['woff', 'ttf', 'eot'].forEach((type) => {
			const name = type.toUpperCase();
			test.ok(fs.existsSync(`test/tmp/one/icons.${type}`), `${name} file created.`);
			test.ok(fs.readFileSync(`test/tmp/one/icons.${type}`, 'utf8').length, `${name} file not empty.`);
		});

		['css', 'html'].forEach((type) => {
			const name = type.toUpperCase();
			test.ok(fs.existsSync(`test/tmp/one/icons.${type}`), `${name} file created.`);
			test.ok(fs.readFileSync(`test/tmp/one/icons.${type}`, 'utf8').length, `${name} file not empty.`);
		});

		const svgs = globSync('test/src_one/**.*');
		const css = fs.readFileSync('test/tmp/one/icons.css', 'utf8');

		// CSS links to font files are correct
		['woff', 'ttf', 'eot'].forEach((type) => {
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

	template: (test: TestContextAssert) => {
		const css = fs.readFileSync('test/tmp/template/icons.css', 'utf8');

		// There should be comment from custom template
		test.ok(
			find(css, 'Custom template'),
			'Comment from custom template.'
		);

		test.done();
	},

	template_scss: (test: TestContextAssert) => {
		const cssFilename = 'test/tmp/template_scss/_icons.scss';

		test.ok(fs.existsSync(cssFilename), 'SCSS template: .scss file created.');

		const css = fs.readFileSync(cssFilename, 'utf8');

		// There should be comment from custom template
		test.ok(
			find(css, 'Custom template'),
			'SCSS template: comment from custom template.'
		);

		test.done();
	},

	template_sass: (test: TestContextAssert) => {
		const cssFilename = 'test/tmp/template_sass/_icons.sass';

		test.ok(fs.existsSync(cssFilename), 'SASS template: .sass file created (stylesheet extension derived from template name).');

		const css = fs.readFileSync(cssFilename, 'utf8');

		// There should be comment from custom template
		test.ok(
			find(css, 'Custom template'),
			'SASS template: comment from custom template.'
		);

		test.done();
	},

	enabled_template_variables: (test: TestContextAssert) => {
		const scssFilename = 'test/tmp/enabled_template_variables/_icons.scss';
		const lessFilename = 'test/tmp/enabled_template_variables/icons.less';
		const htmlFilename = 'test/tmp/enabled_template_variables/icons.html';

		const scss = fs.readFileSync(scssFilename, 'utf8');
		const less = fs.readFileSync(lessFilename, 'utf8');
		const html = fs.readFileSync(htmlFilename, 'utf8');

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

	html_template: (test: TestContextAssert) => {
		const demo = fs.readFileSync('test/tmp/html_template/icons.html', 'utf8');

		// There should be comment from custom template
		test.ok(
			find(demo, 'Custom template'),
			'Comment from custom template.'
		);

		test.done();
	},

	html_filename: (test: TestContextAssert) => {
		const htmlfile = 'test/tmp/html_filename/index.html';

		// There should be comment from custom template
		test.ok(fs.existsSync(htmlfile), 'HTML demo file custom name created.');

		test.done();
	},

	relative_path: (test: TestContextAssert) => {
		const css = fs.readFileSync('test/tmp/relative_path/icons.css', 'utf8');

		// CSS links to font files are correct
		['woff', 'ttf', 'eot'].forEach((type) => {
			test.ok(
				find(css, `url("../iamrelative/icons.${type}`),
				`File path ${type} should be in CSS file.`
			);
		});

		test.done();
	},

	sass: (test: TestContextAssert) => {
		test.ok(fs.existsSync('test/tmp/sass/_icons.sass'), 'SASS file with underscore created.');
		test.ok(!fs.existsSync('test/tmp/sass/icons.sass'), 'SASS file without underscore not created.');
		test.ok(!fs.existsSync('test/tmp/sass/icons.css'), 'CSS file not created.');

		//const svgs = globSync('test/src/**.*');
		const sass = fs.readFileSync('test/tmp/sass/_icons.sass', 'utf8');

		// There should be comment from custom template
		let m = sass.match(/\/\* *(.*?) *\*\//g);
		test.ok(!m, 'No regular CSS comments.');

		// There should be comment from custom template
		m = sass.match(/^\/\//gm);
		test.equal(m && m.length, 2, 'Single line comments.');

		test.done();
	},

	less: (test: TestContextAssert) => {
		test.ok(fs.existsSync('test/tmp/less/icons.less'), 'LESS file created.');
		test.ok(!fs.existsSync('test/tmp/less/icons.css'), 'CSS file not created.');

		const svgs = globSync('test/src/**.*');
		const less = fs.readFileSync('test/tmp/less/icons.less', 'utf8');

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

	css_plus_scss: (test: TestContextAssert) => {
		test.ok(fs.existsSync('test/tmp/scss/_icons.scss'), 'SCSS file with underscore created.');
		test.ok(!fs.existsSync('test/tmp/scss/icons.scss'), 'SCSS file without underscore not created.');
		test.ok(fs.existsSync('test/tmp/css/icons.css'), 'CSS file is created.');

		test.done();
	},

	stylus_bem: (test: TestContextAssert) => {
		test.ok(fs.existsSync('test/tmp/stylus_bem/icons.styl'), 'Stylus file created.');
		test.ok(!fs.existsSync('test/tmp/stylus_bem/icons.css'), 'CSS file not created.');

		const styl = fs.readFileSync('test/tmp/stylus_bem/icons.styl', 'utf8');

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

	stylus_bootstrap: (test: TestContextAssert) => {
		test.ok(fs.existsSync('test/tmp/stylus_bootstrap/icons.styl'), 'Stylus file created.');
		test.ok(!fs.existsSync('test/tmp/stylus_bootstrap/icons.css'), 'CSS file not created.');

		const styl = fs.readFileSync('test/tmp/stylus_bootstrap/icons.styl', 'utf8');

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

	spaces: (test: TestContextAssert) => {
		const css = fs.readFileSync('test/tmp/spaces/icons.css', 'utf8');

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

	disable_demo: (test: TestContextAssert) => {
		test.ok(fs.existsSync('test/tmp/disable_demo/icons.css'), 'CSS file created.');
		test.ok(!fs.existsSync('test/tmp/disable_demo/icons.html'), 'HTML file not created.');

		test.done();
	},

	non_css_demo: (test: TestContextAssert) => {
		test.ok(!fs.existsSync('test/tmp/non_css_demo/icons.css'), 'CSS file not created.');
		test.ok(fs.existsSync('test/tmp/non_css_demo/icons.html'), 'HTML file created.');

		const html = fs.readFileSync('test/tmp/non_css_demo/icons.html', 'utf8');

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
		const svgs = globSync('test/src/**.*');
		svgs.forEach((file) => {
			const id = path.basename(file, '.svg');
			test.ok(
				find(html, `.icon_${id}:before`),
				`Icon ${id} CSS should be in HTML file.`
			);
		});

		test.done();
	},

	parent_source: (test: TestContextAssert) => {
		const svgs = globSync('test/src/**.*');
		const css = fs.readFileSync('test/tmp/parent_source/icons.css', 'utf8');

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

	ligatures: (test: TestContextAssert) => {
		const svgs = globSync('test/ligatures_src/**.*');
		const css = fs.readFileSync('test/tmp/ligatures/icons.css', 'utf8');

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

	duplicate_names: (test: TestContextAssert) => {
		const svgs = globSync('test/src_duplicate_names/**/*.svg');
		const css = fs.readFileSync('test/tmp/duplicate_names/icons.css', 'utf8');

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

	order: (test: TestContextAssert) => {
		//const svgs = globSync('test/src/**.*');
		const css = fs.readFileSync('test/tmp/order/icons.css', 'utf8');

		// Font-face src rules should be in right order
		test.ok(
			find(css, 'src:url("icons.svg#icons") format("svg"),\n\t\turl("icons.woff") format("woff");'),
			'Font-face src rules should be in right order.'
		);

		test.done();
	},

	template_options: (test: TestContextAssert) => {
		const svgs = globSync('test/src/**.*');
		const less = fs.readFileSync('test/tmp/template_options/icons.less', 'utf8');
		const html = fs.readFileSync('test/tmp/template_options/icons.html', 'utf8');

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

	node: (test: TestContextAssert) => {
		// All out files should be created and should not be empty
		['woff', 'ttf', 'eot'].forEach((type) => {
			const name = type.toUpperCase();
			test.ok(fs.existsSync(`test/tmp/node/icons.${type}`), `${name} file created.`);
			test.ok(fs.readFileSync(`test/tmp/node/icons.${type}`, 'utf8').length, `${name} file not empty.`);
		});

		['css', 'html'].forEach((type) => {
			const name = type.toUpperCase();
			test.ok(fs.existsSync(`test/tmp/node/icons.${type}`), `${name} file created.`);
			test.ok(fs.readFileSync(`test/tmp/node/icons.${type}`, 'utf8').length, `${name} file not empty.`);
		});

		const svgs = globSync('test/src/**.*');
		const css = fs.readFileSync('test/tmp/node/icons.css', 'utf8');
		const html = fs.readFileSync('test/tmp/node/icons.html', 'utf8');

		// CSS links to font files are correct
		['woff', 'ttf', 'eot'].forEach((type) => {
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

	ie7: (test: TestContextAssert) => {
		const css = fs.readFileSync('test/tmp/ie7/icons.css', 'utf8');
		const svgs = globSync('test/src/*.svg');
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

	ie7_bootstrap: (test: TestContextAssert) => {
		const css = fs.readFileSync('test/tmp/ie7_bootstrap/icons.css', 'utf8');
		const svgs = globSync('test/src/*.svg');
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

	optimize_enabled: (test: TestContextAssert) => {
		const optimizedPathSegment = '280.2V280.098C349.867 293.072 358.595';
		const svg = fs.readFileSync('test/tmp/optimize_enabled/icons.svg', 'utf8');
		if(svg.indexOf(optimizedPathSegment) === -1) {
			test.fail(true, 'SVG element must be contains the optimized path', undefined, undefined);
		}
		test.done();
	},

	optimize_disabled: (test: TestContextAssert) => {
		const optimizedPathSegment = '280.2V280.098C349.867 293.072 358.595';
		const svg = fs.readFileSync('test/tmp/optimize_disabled/icons.svg', 'utf8');
		if(svg.indexOf(optimizedPathSegment) > -1) {
			test.fail(true, 'SVG element must be contains the un-optimized path', undefined, undefined);
		}
		test.done();
	},

	codepoints: (test: TestContextAssert) => {
		// Default codepoint of 0xE001 can be overidden
		const resultSVG = globSync('test/tmp/codepoints/icons.svg');
		const css = fs.readFileSync('test/tmp/codepoints/icons.css', 'utf8');
		//const html = fs.readFileSync('test/tmp/codepoints/icons.html', 'utf8');
		const startCodepoint = 0x41;

		// Generated SVG font should have glyphs at the overidden codepoints
		resultSVG.forEach((file) => {
			const svgSource = fs.readFileSync(file, 'utf8');
			const glyphs: { unicode: string; }[] = [];

			parseXMLString(svgSource, (err, result) => {
				// Normalise glyphs into JS objects
				result.svg.defs[0].font[0].glyph.forEach((glyph: { $: { unicode: string, "glyph-name": string } }) => {
					if (glyph.$['glyph-name'].length === 1) { // Skip non-characters (.notdef, .null, etc.)
						glyphs.push(glyph.$);
					}
				});

				// Two assertions for each glyph:
				// - each glyph has a unique unicode character
				// - the correct glyph character code is present in the generated CSS
				const unicodeCharArr = glyphs.map((g) => { return g.unicode; });
				for (let index = 0; index < glyphs.length; index++) {
					test.equal(0, findDuplicates(unicodeCharArr).length);
					test.ok(
						find(css, `content:"\\${(startCodepoint + index).toString(16)}"`),
						`Character at index ${index} has its codepoint in the CSS`
					);
				}
			});
		});

		test.done();
	},

	camel: (test: TestContextAssert) => {
		const svgs = globSync('test/camel/*.svg');
		const css = fs.readFileSync('test/tmp/camel/icons.css', 'utf8');

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

	folders: (test: TestContextAssert) => {
		// @todo Temporarily disabled because different fontforge versions produce different paths
		test.done();
		if (true) return;

		const svgFont = fs.readFileSync('test/tmp/folders/icons.svg', 'utf8');
		const paths = JSON.parse(fs.readFileSync('test/src_folders/paths.json', 'utf8'));
		const glyphs: { unicode: string, d: string, "glyph-name": string }[] = [];
		parseXMLString(svgFont, (err, result) => {
			// Normalise glyphs into JS objects
			result.svg.defs[0].font[0].glyph.forEach((glyph: { $: { unicode: string, d: string, "glyph-name": string } }) => {
				if (/^uni/.test(glyph.$['glyph-name'])) { // Skip non-characters (.notdef, .null, etc.)
					glyphs.push(glyph.$);
				}
			});

			glyphs.forEach((glyph) => {
				test.equal(glyph.d, paths[glyph['glyph-name']], `Glyph with codepoint ${glyph.unicode} has correct path.`);
			});
		});

		test.done();
	},

	woff2: (test: TestContextAssert) => {
		// All out files should be created and should not be empty
		['woff', 'woff2'].forEach((type) => {
			const name = type.toUpperCase();
			test.ok(fs.existsSync(`test/tmp/woff2/icons.${type}`), `${name} file created.`);
			test.ok(fs.readFileSync(`test/tmp/woff2/icons.${type}`, 'utf8').length, `${name} file not empty.`);
		});

		// TTF file should be deleted
		['ttf'].forEach((type) => {
			test.ok(!fs.existsSync(`test/tmp/woff2/icons.${type}`), `${type.toUpperCase()} file NOT created.`);
		});

		['css', 'html'].forEach((type) => {
			const name = type.toUpperCase();
			test.ok(fs.existsSync(`test/tmp/woff2/icons.${type}`), `${name} file created.`);
			test.ok(fs.readFileSync(`test/tmp/woff2/icons.${type}`, 'utf8').length, `${name} file not empty.`);
		});

		//const svgs = globSync('test/src/**.*');
		const css = fs.readFileSync('test/tmp/woff2/icons.css', 'utf8');
		//const html = fs.readFileSync('test/tmp/woff2/icons.html', 'utf8');

		// CSS links to font files are correct
		['woff2', 'woff'].forEach((type) => {
			test.ok(
				find(css, `url("icons.${type}`),
				`File path ${type} shound be in CSS file.`
			);
		});

		// CSS links to TTF should not be created
		['ttf'].forEach((type) => {
			test.ok(
				!find(css, `url("icons.${type}`),
				`File path ${type} shound NOT be in CSS file.`
			);
		});

		test.done();
	},

	woff2_node: (test: TestContextAssert) => {
		// All out files should be created and should not be empty
		['woff', 'woff2'].forEach((type) => {
			const name = type.toUpperCase();
			test.ok(fs.existsSync(`test/tmp/woff2_node/icons.${type}`), `${name} file created.`);
			test.ok(fs.readFileSync(`test/tmp/woff2_node/icons.${type}`, 'utf8').length, `${name} file not empty.`);
		});

		// TTF file should be deleted
		['ttf'].forEach((type) => {
			test.ok(!fs.existsSync(`test/tmp/woff2_node/icons.${type}`), `${type.toUpperCase()} file NOT created.`);
		});

		['css', 'html'].forEach((type) => {
			const name = type.toUpperCase();
			test.ok(fs.existsSync(`test/tmp/woff2_node/icons.${type}`), `${name} file created.`);
			test.ok(fs.readFileSync(`test/tmp/woff2_node/icons.${type}`, 'utf8').length, `${name} file not empty.`);
		});

		//const svgs = globSync('test/src/**.*');
		const css = fs.readFileSync('test/tmp/woff2_node/icons.css', 'utf8');
		//const html = fs.readFileSync('test/tmp/woff2_node/icons.html', 'utf8');

		// CSS links to font files are correct
		['woff2', 'woff'].forEach((type) => {
			test.ok(
				find(css, `url("icons.${type}`),
				`File path ${type} shound be in CSS file.`
			);
		});

		// CSS links to TTF should not be created
		['ttf'].forEach((type) => {
			test.ok(
				!find(css, `url("icons.${type}`),
				`File path ${type} shound NOT be in CSS file.`
			);
		});

		test.done();
	},

	target_overrides: (test: TestContextAssert) => {

		//const css = fs.readFileSync('test/tmp/target_overrides_css/icons.css', 'utf8');
		test.ok(fs.existsSync('test/tmp/target_overrides_css/icons.css'), 'CSS file created.');

		['woff', 'ttf', 'eot'].forEach((type) => {
			const name = type.toUpperCase();
			test.ok(fs.existsSync(`test/tmp/target_overrides_icons/icons.${type}`), `${name} file created.`);
			test.ok(fs.readFileSync(`test/tmp/target_overrides_icons/icons.${type}`, 'utf8').length, `${name} file not empty.`);
		});

		test.done();
	},

	font_family_name: (test: TestContextAssert) => {
		const html = fs.readFileSync('test/tmp/font_family_name/icons.html', 'utf8');

		// fontFamilyName should be in the HTML file's title
		test.ok(
			find(html, '<title>customName</title>'),
			'fontFamilyName should be in the HTML file title'
		);

		// File should still have default name if only fontFamilyName is specified
		test.ok(fs.existsSync('test/tmp/font_family_name/icons.ttf'));

		test.done();
	},

	custom_output: (test: TestContextAssert) => {

		// File should have been created when filename is specified
		test.ok(fs.existsSync('test/tmp/custom_output/test-icon-config.js'));

		// File should have been created (with template basename) when filename is not specified
		test.ok(fs.existsSync('test/tmp/custom_output/custom.json'));

		// Files should render with custom context variables
		test.ok(fs.existsSync('test/tmp/custom_output/context-test.html'));

		test.done();
	},

	filename_length: (test: TestContextAssert) => {

		// File should have been created.
		test.ok(fs.existsSync('test/tmp/filename_length/icons.css'));

		// File should have been created.
		test.ok(fs.existsSync('test/tmp/filename_length/icons.woff'));

		// File should have been created.
		test.ok(fs.existsSync('test/tmp/filename_length/icons.html'));

		test.done();
	}

};
