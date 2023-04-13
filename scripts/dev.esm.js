// @ts-check

import { build } from "esbuild"
import { resolve, dirname } from 'path'
import { fileURLToPath } from "url"

const target = 'reactivity'
const __dirname = dirname(fileURLToPath(import.meta.url))

build({
	entryPoints: [resolve(__dirname, `../packages/${target}/src/index.ts`)],
	outfile: resolve(__dirname, `../packages/${target}/dist/index.js`),
	format: "esm",
	sourcemap: true,
	bundle: true, // bundle depended files
	platform: 'browser',
	watch: {
		onRebuld() {
			console.log('rebuild~~~')
		}
	}
}).then(() => console.log('watching~~~'))