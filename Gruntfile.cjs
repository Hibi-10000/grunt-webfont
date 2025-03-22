'use strict';

const path = require('node:path');
const loadGruntTasks = require('load-grunt-tasks');
const webfont = require('./tasks/webfont.js').default;

module.exports = (/** @type {import('grunt')} */grunt) => {
	loadGruntTasks(grunt);

	webfont(grunt);

	grunt.initConfig({
		webfont: {
			test1: {
				src: 'test/src/*.svg',
				dest: 'test/tmp/test1',
				options: {
					hashes: false
				}
			},
			embed: {
				src: 'test/src/*.svg',
				dest: 'test/tmp/embed',
				options: {
					hashes: false,
					embed: true
				}
			},
			embed_ttf: {
				src: 'test/src/*.svg',
				dest: 'test/tmp/embed_ttf',
				options: {
					types: 'ttf',
					hashes: false,
					embed: 'ttf'
				}
			},
			one: {
				src: 'test/src_one/*.svg',
				dest: 'test/tmp/one',
				options: {
					hashes: false
				}
			},
			template: {
				src: 'test/src/*.svg',
				dest: 'test/tmp/template',
				options: {
					template: 'test/templates/template.css'
				}
			},
			html_template: {
				src: 'test/src/*.svg',
				dest: 'test/tmp/html_template',
				options: {
					htmlDemoTemplate: 'test/templates/template.html'
				}
			},
			html_filename: {
				src: 'test/src/*.svg',
				dest: 'test/tmp/html_filename',
				options: {
					htmlDemoFilename: 'index'
				}
			},
			relative_path: {
				src: 'test/src/*.svg',
				dest: 'test/tmp/relative_path',
				options: {
					relativeFontPath: '../iamrelative',
					hashes: false
				}
			},
			spaces: {
				src: 'test/src_space/*.svg',
				dest: 'test/tmp/spaces'
			},
			disable_demo: {
				src: 'test/src_one/*.svg',
				dest: 'test/tmp/disable_demo',
				options: {
					htmlDemo: false
				}
			},
			parent_source: {
				src: '../grunt-webfont/test/src/*.svg',
				dest: 'test/tmp/parent_source',
				options: {
					hashes: false
				}
			},
			// #167: Ligatures with hypen don’t work
			ligatures: {
				src: 'test/src_ligatures/*.svg',
				dest: 'test/tmp/ligatures',
				options: {
					hashes: false,
					ligatures: true
				}
			},
			duplicate_names: {
				src: '../grunt-webfont/test/src_duplicate_names/**/*.svg',
				dest: 'test/tmp/duplicate_names',
				options: {
					hashes: false,
					rename: function(name) {
						return [path.basename(path.dirname(name)), path.basename(name)].join('-');
					}
				}
			},
			ie7: {
				src: 'test/src/*.svg',
				dest: 'test/tmp/ie7',
				options: {
					hashes: false,
					ie7: true,
					syntax: 'bem'
				}
			},
			ie7_bootstrap: {
				src: 'test/src/*.svg',
				dest: 'test/tmp/ie7_bootstrap',
				options: {
					hashes: false,
					ie7: true,
					syntax: 'bootstrap'
				}
			},
			codepoints: {
				src: 'test/src/*.svg',
				dest: 'test/tmp/codepoints',
				options: {
					hashes: false,
					startCodepoint: 0x41,
					codepoints: {
						single: 0x43
					}
				}
			},
			camel: {
				src: 'test/camel/*.svg',
				dest: 'test/tmp/camel',
				options: {
					hashes: false
				}
			},
			folders: {
				src: 'test/src_folders/**/*.svg',
				dest: 'test/tmp/folders',
				options: {
					hashes: false
				}
			},
			target_overrides: {
				src: 'test/src/*.svg',
				options: {
					dest: 'test/tmp/target_overrides_icons',
					destCss: 'test/tmp/target_overrides_css',
				}
			},
			font_family_name: {
				src: 'test/src/*.svg',
				dest: 'test/tmp/font_family_name',
				options: {
					fontFamilyName: 'customName',
					types: 'ttf',
				}
			},
			custom_output: {
				src: 'test/src/*.svg',
				options: {
					dest: 'test/tmp/custom_output_icons',
					destCss: 'test/tmp/custom_output_css',
					customOutputs: [{
						template: 'test/templates/custom.js',
						dest: 'test/tmp/custom_output/test-icon-config.js'
					}, {
						template: 'test/templates/custom.json',
						dest: 'test/tmp/custom_output'
					}, {
						template: 'test/templates/context-test.html',
						dest: 'test/tmp/custom_output',
						context: {
							testHeading: 'Hello, world!'
						}
					}]
				}
			},
			enabled_template_variables: {
				src: 'test/src/*.svg',
				dest: 'test/tmp/enabled_template_variables',
				options: {
					relativeFontPath: '../iamrelative',
					fontPathVariables: true,
					stylesheets: ['css']
				}
			},
		},
		nodeunit: {
			all: ['test/webfont_test.js']
		},
		clean: ['test/tmp']
	});

	grunt.loadTasks('tasks');

	grunt.registerTask('test', ['nodeunit']);
	grunt.registerTask('default', ['clean', 'webfont', 'test', 'clean']);
};
