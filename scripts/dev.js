// @ts-check

import { build } from "esbuild"
import { resolve } from 'node:path'

const target = 'reactivity'

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