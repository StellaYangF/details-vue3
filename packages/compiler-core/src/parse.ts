import { NodeTypes } from "./compile"

export interface ParserContext {
  readonly originalSource: string
  source: string
  line: number
  column: number
  offset: number
}

// ast.ts
export interface Position {
  offset: number //from start of file
  line: number,
  column: number
}

export interface SourceLocation {
  start: Position
  end: Position
  source: string
}

// TODO: RootNode should be returned.
export function baseParse(content: string) {
  const context = createParserContext(content)
  return parseChildren(context)
}

export interface Node {
  type: NodeTypes
  loc: SourceLocation
}

export interface TextNode extends Node {
  type: NodeTypes.TEXT
  content: string
}

export type TemplateChildNode =
  | TextNode

function createParserContext(content: string) {
  return {
    line: 1,
    column: 1,
    offset: 0,
    source: content,
    originalSource: content
  }
}

function parseChildren(
  context: ParserContext
): TemplateChildNode[] {
  const nodes: TemplateChildNode[] = []

  while (!isEnd(context)) {
    const s = context.source
    let node
    if (s.startsWith('{{')) {
      // TODO: process expression
      node = {}
    } else if (s[0] === '<') {
      // TODO: process element
      node = {}
    }
    if (!node) {
      // parseText
      node = parseText(context)
    }

    nodes.push(node)
    break
  }

  return nodes
}

const isEnd = (context: ParserContext): boolean => !context.source

function parseText(context): TextNode {
  // Hello {{name}}</div> | Hello </div>{{name}}
  const endTokens = ['<', '{']
  let endIndex = context.source.length

  for (let i = 0; i < endTokens.length; i++) {
    const index = context.source.indexOf(endTokens[i], 1)
    if (index !== -1 && endIndex > index) {
      endIndex = index
    }
  }

  let start = getCursor(context)
  const content = parseTextData(context, endIndex)

  return {
    type: NodeTypes.TEXT,
    content,
    loc: getSelection(context, start)
  }
}

function getCursor(
  context: ParserContext
): Position {
  const { column, line, offset } = context

  return { column, line, offset }
}

function parseTextData(
  context: ParserContext,
  endIndex: number
): string {

  const rawText = context.source.slice(0, endIndex)
  advanceBy(context, endIndex)
  return rawText
}

function advanceBy(
  context: ParserContext,
  endIndex: number
): void {
  const s = context.source
  advancePositionWithMutation(context, s, endIndex)
  context.source = s.slice(endIndex)
}

// update context
function advancePositionWithMutation(
  context: ParserContext,
  s: string,
  endIndex: number
): void {
  let linesCount = 0
  let linePos = -1
  for (let i = 0; i < endIndex; i++) {
    if (s.charCodeAt(i) === 10) { // \n new line
      linesCount++
      linePos = i
    }
  }
  context.offset += endIndex
  context.line += linesCount

  context.column = linePos === -1
    ? context.column + endIndex
    : endIndex - linePos
}

function getSelection(
  context: ParserContext,
  start: Position
): SourceLocation {
  const end = getCursor(context)
  return {
    start,
    end,
    source: context.originalSource.slice(start.offset, end.offset)
  }
}