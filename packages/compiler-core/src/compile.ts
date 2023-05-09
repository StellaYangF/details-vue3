import { generate } from "./codegen"
import { baseParse } from "./parse"
import { transform } from "./transform"

export function baseCompile(template) {
  // 1. 将模板转化成 ast 模板
  const ast = baseParse(template)
  console.log(ast)
  // 2. 对 ast 语法树进行转化
  transform(ast)
  // 生成代码
  return generate(ast)
}