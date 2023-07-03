// @ts-check

const esbuild = require('esbuild')
const { resolve } = require('path')

const target = 'vue-router'

esbuild.context({
	entryPoints: [resolve(__dirname, `../packages/${target}/src/index.ts`)],
	outfile: resolve(__dirname, `../packages/${target}/dist/index.js`),
	bundle: true, // bundle depended files
	sourcemap: true,
	format: "esm",
	platform: 'browser'
}).then(ctx => {
	console.log('~~~watching~~~', ctx)
	ctx.watch()
})