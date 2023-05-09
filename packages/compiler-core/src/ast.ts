export type Namespace = number

export const enum NodeTypes {
  ROOT,
  ELEMENT,
  TEXT,
  COMMENT,
  SIMPLE_EXPRESSION,
  INTERPOLATION, // template expression
  ATTRIBUTE,
  DIRECTIVE,
  COMPOUND_EXPRESSION,
  IF,
  IF_BRANCH,
  FOR,
  TEXT_CALL,
  VNODE_CALL,
  JS_CALL_EXPRESSION
}

export const enum ElementTypes {
  ELEMENT,
  COMPONENT,
  SLOT,
  TEMPLATE
}

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
export interface Node {
  type: NodeTypes
  loc: SourceLocation
}

export interface TextNode extends Node {
  type: NodeTypes.TEXT
  content: string
}

export interface SimpleExpressionNode extends Node {
  type: NodeTypes.SIMPLE_EXPRESSION
  content: string
  isStatic: boolean
}
export interface CompoundExpressionNode extends Node {
  type: NodeTypes.COMPOUND_EXPRESSION
  children: (
    | SimpleExpressionNode
    | CompoundExpressionNode
    | InterpolationNode
    | TextNode
    | string
    | symbol
  )[]
}

export type ExpressionNode = SimpleExpressionNode | CompoundExpressionNode

export type ElementNode =
  | PlainElementNode

export interface BaseElementNode extends Node {
  type: NodeTypes.ELEMENT
  ns?: Namespace
  tag: string
  tagType?: ElementTypes
  isSelfClosing: boolean
  props?: Array<AttributeNode>
  children?: TemplateChildNode[]
}

export interface AttributeNode extends Node {
  type: NodeTypes.ATTRIBUTE
  name: string
  value: TextNode | undefined
}
export interface PlainElementNode extends BaseElementNode {
  tagType?: ElementTypes
}
export interface InterpolationNode extends Node {
  type: NodeTypes.INTERPOLATION
  content: ExpressionNode
}

export type TemplateChildNode =
  | TextNode