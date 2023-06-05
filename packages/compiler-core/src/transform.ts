import { NO, isArray, isString } from "@vue/shared"
import { NodeTypes, ParentNode, RootNode, TemplateChildNode } from "./ast"
import { TO_DISPLAY_STRING } from "./runtimeHelpers"

export interface TransformContext {
  root: RootNode
  helpers: Map<symbol, number>
  parent: ParentNode
  currentNode: RootNode | TemplateChildNode | null
  helper<T extends symbol>(name: T): T
  removeHelper<T extends symbol>(name: T): void
  nodeTransforms: Array<any>
  childIndex: number
  onNodeRemoved(): void
  removeNode(node?: TemplateChildNode): void
}

export function transform(root: RootNode) {
  const context = createTransformContext(root)
  traverseNode(root, context)
}

function createTransformContext(root): TransformContext {
  const context: TransformContext = {
    root,
    currentNode: root,
    parent: null,
    nodeTransforms: [
      transformElement,
      transformText,
      transformExpression
    ],
    helpers: new Map(), // record transforms call nums
    helper(name) {
      const count = context.helpers.get(name) || 0
      context.helpers.set(name, count + 1)
      return name
    },
    removeHelper(name) {
      const count = context.helpers.get(name)
      if (count) {
        const currentCount = count - 1
        if (!currentCount) {
          context.helpers.delete(name)
        } else {
          context.helpers.set(name, currentCount)
        }
      }
    },
    childIndex: 0,
    onNodeRemoved: () => { },
    removeNode(node) {
      const list = context.parent.children
      const removalIndex = node
        ? list.indexOf(node)
        : context.currentNode
          ? context.childIndex
          : -1
      if (!node || node === context.currentNode) {
        context.currentNode = null
        context.onNodeRemoved()
      } else {
        // sibling node removed
        if (context.childIndex > removalIndex) {
          context.childIndex--
          context.onNodeRemoved()
        }
      }
      context.parent.children.splice(removalIndex, 1)
    }

  }

  return context
}

function transformElement(node) {
  if (node.type === NodeTypes.ELEMENT) {
    return function postTransformElement() {
      console.log('transform element', node)
    }
  }
}

function transformText(node: RootNode | TemplateChildNode) {
  if (node.type === NodeTypes.ELEMENT || node.type === NodeTypes.ROOT) {
    return () => {
      let hasText = false
      const children = node.children
      const currentContainer = undefined // combine children
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        // if (isText(child)) {
        //   hasText = true
        // }
      }
    }
  }
}

function transformExpression(node) {
  if (node.type === NodeTypes.INTERPOLATION) {
    // update content
    node.content.content = `_ctx.${node.content.content}`
  }
}

function traverseNode(
  node: RootNode | TemplateChildNode,
  context: TransformContext
) {
  context.currentNode = node

  // apply transform plugins
  const { nodeTransforms } = context
  const exitFns = []
  for (let i = 0; i < nodeTransforms.length; i++) {
    const onExit = nodeTransforms[i](node, context)
    if (onExit) {
      if (isArray(onExit)) {
        exitFns.push(...onExit)
      } else {
        exitFns.push(onExit)
      }
    }

    if (!context.currentNode) {
      // node was removed
      return
    } else {
      // node may have been replaced
      node = context.currentNode
    }
  }

  switch (node.type) {
    case NodeTypes.INTERPOLATION:
      // no need to traverse, but we need to inject toString helper
      context.helper(TO_DISPLAY_STRING)
      break
    case NodeTypes.ELEMENT:
    case NodeTypes.ROOT:
      traverseChildren(node, context)
      break
  }

  // exit transforms
  context.currentNode = node
  let i = exitFns.length
  while (i--) {
    exitFns[i]()
  }
}

function traverseChildren(
  parent: ParentNode,
  context: TransformContext
) {
  let i = 0
  const nodeRemoved = () => {
    i--
  }

  for (; i < parent.children?.length; i++) {
    const child = parent.children[i]
    if (isString(child)) continue
    context.parent = parent
    context.childIndex = i
    context.onNodeRemoved = nodeRemoved
    traverseNode(child, context)
  }
}