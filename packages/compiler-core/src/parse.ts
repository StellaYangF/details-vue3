import {
  ElementNode,
  InterpolationNode,
  NodeTypes,
  ParserContext,
  Position,
  SourceLocation,
  TemplateChildNode,
  TextNode
} from "./ast"

function createParserContext(content: string) {
  return {
    line: 1,
    column: 1,
    offset: 0,
    source: content,
    originalSource: content
  }
}

// TODO: RootNode should be returned.
export function baseParse(content: string) {
  const context = createParserContext(content)
  return parseChildren(context)
}

function parseChildren(
  context: ParserContext
): TemplateChildNode[] {
  const nodes: TemplateChildNode[] = []

  while (!isEnd(context)) {
    const s = context.source
    let node
    if (s.startsWith('{{')) {
      node = parseInterpolation(context)
    } else if (s[0] === '<') {
      node = parseElement(context)
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

const isEnd = (context: ParserContext): boolean => {
  const source = context.source
  if (context.source.startsWith('</')) { // denote no children
    return true
  }
  return !source
}

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
  numberOfCharacters: number
): void {
  const s = context.source
  advancePositionWithMutation(context, s, numberOfCharacters)
  context.source = s.slice(numberOfCharacters)
}

// update context
function advancePositionWithMutation(
  pos: Position,
  source: string,
  numberOfCharacters: number
): Position {
  let linesCount = 0
  let linePos = -1
  for (let i = 0; i < numberOfCharacters; i++) {
    if (source.charCodeAt(i) === 10) { // \n new line
      linesCount++
      linePos = i
    }
  }
  pos.offset += numberOfCharacters
  pos.line += linesCount
  pos.column = linePos === -1
    ? pos.column + numberOfCharacters
    : numberOfCharacters - linePos

  return pos
}

function getSelection(
  context: ParserContext,
  start: Position,
  end?: Position
): SourceLocation {
  end = end || getCursor(context)
  return {
    start,
    end,
    source: context.originalSource.slice(start.offset, end.offset)
  }
}

function parseInterpolation(
  context: ParserContext
): InterpolationNode | undefined {
  // {{state.name}}
  const [open, close] = ['{{', '}}']
  const closeIndex = context.source.indexOf(close, open.length)

  if (closeIndex === -1) {
    // EmitError
    return undefined
  }

  const start = getCursor(context)
  advanceBy(context, open.length)
  const innerStart = getCursor(context)
  const innerEnd = getCursor(context)
  const rawContentLength = closeIndex - open.length
  const rawContent = context.source.slice(0, rawContentLength)
  const preTrimContent = parseTextData(context, rawContentLength)
  const content = preTrimContent.trim()
  const startOffset = preTrimContent.indexOf(content)
  if (startOffset > 0) {
    advancePositionWithMutation(innerStart, rawContent, startOffset)
  }
  const endOffset = rawContentLength - (preTrimContent.length - content.length - startOffset)
  advancePositionWithMutation(innerEnd, rawContent, endOffset)
  advanceBy(context, close.length)

  return {
    type: NodeTypes.INTERPOLATION,
    content: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      isStatic: false,
      content,
      loc: getSelection(context, innerStart, innerEnd)
    },
    loc: getSelection(context, start)
  }
}

function parseElement(context: ParserContext): ElementNode | undefined {
  const ele = parseTag(context, TagType.Start)
  const children = parseChildren(context)

  if (context.source.startsWith('</')) {
    parseTag(context, TagType.End)
  }
  ele.loc = getSelection(context, ele.loc.start)
  ele.children = children
  return ele
}

const enum TagType {
  Start,
  End
}

function parseTag(context: ParserContext, type: TagType.Start): ElementNode
function parseTag(context: ParserContext, type: TagType.End): void
function parseTag(context: ParserContext, type: TagType): ElementNode | undefined {
  const start = getCursor(context)
  // <div id=""></div>
  const match = /^<\/?([a-z][^\t\r\n\f />]*)/i.exec(context.source)
  const tag = match[1] // <div
  advanceBy(context, match[0].length)
  advanceSpaces(context)
  const isSelfClosing = context.source.startsWith('/>') //<slot />
  advanceBy(context, isSelfClosing ? 2 : 1)

  if (type === TagType.End) {
    return
  }

  return {
    type: NodeTypes.ELEMENT,
    tag,
    isSelfClosing,
    loc: getSelection(context, start)
  }
}

function advanceSpaces(context: ParserContext): void {
  const match = /^[\t\r\n]+/.exec(context.source) // null
  if (match) {
    advanceBy(context, match[0].length)
  }
}