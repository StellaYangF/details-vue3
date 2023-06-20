## Add Dependencies

```cmd
pnpm install typescript rollup rollup-plugin-typescript2 @rollup/plugin-json @rollup/plugin-node-resolve @rollup/plugin-commonjs minimist execa@4 esbuild   -D -w

```

1. 基于 typescript 开发，配置 tsconfig 文件
```js
pnpm tsc --init

// 生成如下代码 tsconfig.json
{
  "compilerOptions": {
    "outDir": "dist",
    "sourceMap": true,
    "target": "ES2016",
    "newLine": "lf",
    "useDefineForClassFields": false,
    "module": "ESNext",
    "moduleResolution": "node",
    "allowJs": false,
    "strict": false,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "jsx": "preserve",
    "lib": [
      "ESNext",
      "DOM"
    ],
    // 配置当前项目引入路径别名(reactivity引入shared方法，可直接 import from "@vue/shared")
    "baseUrl": ".",
    "paths": {
      "@vue/*": [
        "package/*/src"
      ]
    }
  }
}
```
