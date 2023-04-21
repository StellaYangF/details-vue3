
// 虚拟节点标识符
// 位运算比运算快，常见三种
// << 左移运算符（二进制补位0，后边数字移动位数）

import { isArray, isObject, isString } from "@vue/shared"

// >> 右移
export const enum ShapeFlags {
  ELEMENT = 1,
  FUNCTION_COMPONENT = 1 << 1,
  STATEFUL_COMPONENT = 1 << 2,
  TEXT_CHILDREN = 1 << 3,
  ARRAY_CHILDREN = 1 << 4,
  SLOTS_CHILDREN = 1 << 5,
  TELTEPORT = 1 << 6,
  SUSPENSE = 1 << 7,
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8,
  COMPONENT_KEPT_ALIVE = 1 << 9,
  COMPOENNT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTION_COMPONENT
}

/**
 * ~  取反
 * |  或
 * &  与
 * ^  异或
 */


export function createRenderer(options) {
  return baseCreateRenderer(options)
}

function baseCreateRenderer(options, createHydrationFns?) {
  const {
    insert: hostInsert,
    remove: hostRemove,
    createElement: hostCreateElement,
    createText: hostCreateText,
    createComment: hostCreateComment,
    setText: hostSetText,
    setElementText: hostSetElementText,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling,
    querySelector: hostQuerySelector
  } = options

}

export function isVNode(value) {
  return value ? value.__v_isVNode === true : false
}

export const createVNode = (type, props, children = null) => {
  const shapeFlag = isString(type) ? ShapeFlags.ELEMENT : 0

  const vnode = {
    __v_isVNode: true,
    type,
    props,
    key: props && props.key,
    el: null,
    children,
    shapeFlag
  }

  if (children) {
    let type = 0
    if (isArray(children)) {
      type = ShapeFlags.ARRAY_CHILDREN
    } else {
      children = String(children)
      type = ShapeFlags.TEXT_CHILDREN
    }

    vnode.shapeFlag |= type // 见1是1
  }

  return vnode
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
    } else if (l === 3) {
      children = [children]
    }
    return createVNode(type, propsOrChildren, children)
  }
}