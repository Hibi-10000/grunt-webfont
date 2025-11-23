export interface Logger {
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

export type FontFormat = 'eot' | 'woff2' | 'woff' | 'ttf' | 'svg';

export interface CustomOutput {
	template: string,
	dest: string,
	syntax?: string,
	context?: Partial<Context>,
}

export interface TemplateOptions {
	baseClass?: string,
	classPrefix?: string,
}

export interface Configs {
	[key: string]: Config,
}

export interface Config {
	src: string,
	dest?: string,
	destCss?: string,
	destScss?: string,
	destSass?: string,
	destLess?: string,
	destStyl?: string,
	options?: Options,
}

export interface Options {
	font?: string,
	destCss?: string,
	destScss?: string,
	destSass?: string,
	destLess?: string,
	destStyl?: string,
	dest?: string,
	relativeFontPath?: string,
	fontPathVariables?: boolean,
	hashes?: boolean,
	ligatures?: boolean,
	template?: string,
	syntax?: string,
	templateOptions?: TemplateOptions,
	stylesheets?: string[],
	stylesheet?: string,
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
	codepointsFile?: string, // | fs.PathLike,
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

export interface OptionsInternal extends TemplateOptions {
	logger: Logger,
	fontBaseName: string,
	destCss: string,
	destScss: string,
	destSass: string,
	destLess: string,
	destStyl: string,
	dest: string,
	relativeFontPath: string,
	fontPathVariables: boolean,
	addHashes: boolean,
	addLigatures: boolean,
	template: string,
	syntax: string,
	templateOptions: TemplateOptions,
	stylesheets: string[],
	htmlDemo: boolean,
	htmlDemoTemplate: string,
	htmlDemoFilename: string,
	styles: string[] | string,
	types: FontFormat[],
	order: FontFormat[],
	embed: FontFormat[],
	rename: (path: string, suffix?: string) => string,
	engine: 'fontforge' | 'node',
	autoHint: boolean,
	codepoints: { [key: string]: number },
	codepointsFile: string, // | fs.PathLike,
	startCodepoint: number,
	ie7: boolean,
	normalize: boolean,
	optimize: boolean,
	round: number,
	fontHeight: number,
	descent: number,
	version: string | boolean,
	cache: string,
	callback: (filename: string, types: FontFormat[], glyphs: string[], hash: string) => void,
	customOutputs: CustomOutput[],
	execMaxBuffer: number,

	fontName?: string,
	destCssPaths?: {
		css: string,
		scss: string,
		sass: string,
		less: string,
		styl: string,
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
	fontPathVariable?: string,
}

export interface Context extends OptionsInternal {
	testHeading?: string,
	stylesheet?: string,
	iconsStyles?: true,
}

export interface ReadableStreamWithMetadata extends NodeJS.ReadableStream {
	metadata?: {
		unicode: string[],
		name: string,
	}
}
