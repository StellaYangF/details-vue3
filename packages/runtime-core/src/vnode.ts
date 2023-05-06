import { isArray, isObject, isString } from "@vue/shared"
import { ShapeFlags } from "./renderer"

export const Text = Symbol.for('v-text')
export const Fragment = Symbol.for('v-fgt') as any as {
  __isFragment: true,
  new(): {
    $props: any
  }
}

export function isVNode(value) {
  return value ? value.__v_isVNode === true : false
}

export function h(type, propsOrChildren?, children?) {
  const l = arguments.length
  if (l === 2) {
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      if (isVNode(propsOrChildren)) {
        return createVNode(type, null, [propsOrChildren])
      }
      return createVNode(type, propsOrChildren)
    } else {
      return createVNode(type, null, propsOrChildren)
    }
  } else {
    if (l > 3) {
      children = Array.prototype.slice.call(arguments, 2)
    } else if (l === 3 && isVNode(children)) {
      // 子元素是虚拟节点，包一层
      children = [children]
    }
    return createVNode(type, propsOrChildren, children)
  }
}

/**
 * @param type 
 * @param props 
 * @param children 三种类型：数组，文本，null
 * @param patchFlag compiler generated code, taking fast path
 * @returns 
 */
export const createVNode = (type, props, children = null, patchFlag?) => {
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT
    : isObject(type)
      ? ShapeFlags.STATEFUL_COMPONENT
      : 0

  const vnode = {
    __v_isVNode: true,
    type,
    props,
    key: props && props.key,
    el: null,
    children,
    shapeFlag,
    patchFlag
  }

  if (children) {
    let type = 0
    if (isArray(children)) {
      type = ShapeFlags.ARRAY_CHILDREN
    } else if (isObject(children)) {// slots
      type = ShapeFlags.SLOTS_CHILDREN
    } else {
      children = String(children)
      type = ShapeFlags.TEXT_CHILDREN
    }

    vnode.shapeFlag |= type // 见1是1
  }

  // dynamicChildren patchFlags
  if (currentBlock && patchFlag > 0) {
    currentBlock.push(vnode)
  }

  return vnode
}


// 靶向更新实现
export { createVNode as createElementVNode }

let currentBlock = null
export function openBlock() {
  currentBlock = []
}

export function closeBlock() {
  currentBlock = null
}

export function createElementBlock(type, props?, children?, patchFlag?) {
  return setupBlock(createVNode(type, props, children, patchFlag))
}

export function setupBlock(vnode) {
  vnode.dynamicChildren = currentBlock
  closeBlock()
  return vnode
}

export function createTextVNode(text: ' ', flag = 0) {
  return createVNode(Text, null, text, flag)
}

export function toDisplayString(val) {
  return isString(val)
    ? val
    : val == null
      ? ''
      : isObject(val)
        ? JSON.stringify(val)
        : String(val)
}