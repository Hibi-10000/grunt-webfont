/// <reference types="node" />

interface Logger {
	log: {
		error: (...args: any[]) => void,
		warn: (...args: any[]) => void,
		info: (...args: any[]) => void,
		verbose: (...args: any[]) => void,
	},
	fail: {
		fatal: (...args: any[]) => void,
		warn?: (...args: any[]) => void,
	},
}

interface CustomOutput {
	template: string,
	dest: string,
	syntax?: string,
	context?: Context,
}

interface Configs {
	[key: string]: Config,
}

interface Config {
	src: string,
	dest?: string,
	destCss?: string,
	options?: Options,
}

interface Options {
	font?: string,
	destCss?: string,
	dest?: string,
	relativeFontPath?: string,
	hashes?: boolean,
	ligatures?: boolean,
	template?: string,
	syntax?: string,
	templateOptions?: object | Partial<OptionsInternal>,
	htmlDemo?: boolean,
	htmlDemoTemplate?: string,
	htmlDemoFilename?: string,
	styles?: string, //"foo,bar"
	types?: string, //"foo,bar"
	order?: string, //"foo,bar"
	embed?: boolean | string, //"foo,bar"
	rename?: (path: string, suffix?: string) => string,
	engine?: 'fontforge' | 'node',
	autoHint?: boolean,
	codepoints?: { [key: string]: number },
	codepointsFile?: string | fs.PathLike,
	startCodepoint?: number,
	ie7?: boolean,
	normalize?: boolean,
	optimize?: boolean,
	round?: number,
	fontHeight?: number,
	descent?: number,
	version?: string | boolean,
	cache?: string,
	callback?: (filename: string, types: string[], glyphs: string[], hash: string) => void,
	customOutputs?: CustomOutput[],
	execMaxBuffer?: number,

	destHtml?: string,
	fontFilename?: string,
	fontFamilyName?: string,
	skip?: boolean,
}

interface OptionsInternal {
	logger: Logger,
	fontBaseName: string,
	destCss: string,
	dest: string,
	relativeFontPath: string,
	addHashes: boolean,
	addLigatures: boolean,
	template: string,
	syntax: string,
	templateOptions: object | Partial<OptionsInternal>,
	stylesheets: string[],
	htmlDemo: boolean,
	htmlDemoTemplate: string,
	htmlDemoFilename: string,
	styles: string[] | string,
	types: string[],
	order: string[],
	embed: string[],
	rename: (path: string, suffix?: string) => string,
	engine: 'fontforge' | 'node',
	autoHint: boolean,
	codepoints: { [key: string]: number },
	codepointsFile: string | fs.PathLike,
	startCodepoint: number,
	ie7: boolean,
	normalize: boolean,
	optimize: boolean,
	round: number,
	fontHeight: number,
	descent: number,
	version: string | boolean,
	cache: string,
	callback: (filename: string, types: string[], glyphs: string[], hash: string) => void,
	customOutputs: CustomOutput[],
	execMaxBuffer: number,

	fontName?: string,
	destCssPaths?: {
		css: string,
	},
	destHtml?: string,
	fontfaceStyles?: boolean,
	baseStyles?: boolean,
	extraStyles?: boolean,
	files?: string[],
	glyphs?: string[],
	hash?: string,
	fontFilename?: string,
	fontFamilyName?: string,
	fontSrc1?: string,
	fontSrc2?: string,
	fontRawSrcs?: string[][],
	cssTemplate?: {
		filename: string,
		template: string, //html code
	},
	testHeading?: string,
	baseClass?: string,
	classPrefix?: string,
	stylesheet?: string,
	iconsStyles?: true,
}

interface Context extends Partial<OptionsInternal> {
}
