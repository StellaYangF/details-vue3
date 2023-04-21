
// 虚拟节点标识符
// 位运算比运算快，常见三种
// << 左移运算符（二进制补位0，后边数字移动位数）

import { isArray, isObject, isString } from "@vue/shared"
import { renderOptions } from "@vue/runtime-dom"

// >> 右移
export const enum ShapeFlags {
  ELEMENT = 1, // 元素
  FUNCTION_COMPONENT = 1 << 1, // 函数式组件
  STATEFUL_COMPONENT = 1 << 2, // 普通状态组件
  TEXT_CHILDREN = 1 << 3, // 子元素为文本
  ARRAY_CHILDREN = 1 << 4, // 子元素为数组
  SLOTS_CHILDREN = 1 << 5, // 组件插槽
  TELTEPORT = 1 << 6, // 传送门组件
  SUSPENSE = 1 << 7, // 异步加载组件
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8, // keep-alive
  COMPONENT_KEPT_ALIVE = 1 << 9,
  COMPOENNT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTION_COMPONENT
}

/**
 * ~  取反-> 01互换
 * |  或  -> 00才是0
 * &  与  -> 11才是1
 * ^  异或-> 两位两同0，相异1
 */

const isSameVNodeType = (n1, n2) => {
  return n1.type === n2.type && n1.key === n2.key
}

export function createRenderer(options) {
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
    querySelector: hostQuerySelector,
    patchProp: hostPatchProp
  } = options

  const mountElement = (vnode, container) => {
    const { type, props, shapeFlag } = vnode

    // 1. createElement & 真实节点放在 _vnode 属性上
    const el = vnode.el = hostCreateElement(type)

    // 2. patch props
    if (props) {
      for (const key in props) {
        hostPatchProp(el, key, null, props[key])
      }
    }
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 子元素是文本
      hostSetElementText(el, vnode.children)

    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 子元素是数组
      mountChildren(vnode.children, el)
    }


    hostInsert(el, container)
  }

  const mountChildren = (children, container) => {
    for (let i = 0; i < children.length; i++) {
      // 子元素继续 patch
      patch(null, children[1], container)
    }
  }

  const unmount = vnode => {
    hostRemove(vnode.el)
  }

  const patchProp = (oldProps, newProps) => { }

  const unmountChildren = children => {
    for (let i = 0; i < children.length; i++) {
      hostRemove(children[i])
    }
  }

  const patchChildren = (n1, n2, el) => {
    const c1 = n1.children
    const c2 = n2.children

    const prevShapeFlag = c1.shapeFlag
    const shapeFlag = c2.shapeFlag

    if (shapeFlag & shapeFlag.TEXT_CHILDREN) {
      // 新元素是文本 | 老：数组、文本、空
      if (prevShapeFlag & shapeFlag.ARRAY_CHILDREN) {
        unmountChildren(c1)
      }
      if (c1 !== c2) {
        hostSetElementText(el, c2)
      }
    } else {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // core diff 算法
        } else {
          unmountChildren(c1)
        }
      } else { }
    }
  }

  const patchElement = (n1, n2) => {
    const el = n2.el = n1.el

    const oldProps = n1.props || {}
    const newProps = n2.props || {}

    patchProp(oldProps, newProps)
    patchChildren(n1, n2, el)
  }

  const patch = (n1, n2, container) => {
    // 初始化 & diff 算法

    // 1. 同一个 VNode 不用处理
    if (n1 === n2) return

    // 2. 两元素不同，卸载老的 VNode
    if (n1 && !isSameVNodeType(n1, n2)) {
      unmount(n1)
      n1 = null
    }

    if (n1 == null) {
      // mount
      mountElement(n2, container)
    } else {
      // diff 算法 - 前后元素一致
      patchElement(n1, n2)
    }
  }

  const render = (vnode, container) => {
    if (vnode == null) {
      // unmount
      unmount(container._vnode)
    } else {
      patch(container._vnode || null, vnode, container)
    }
    container._vnode = vnode
  }

  return {
    render
  }
}


export function render(vdnode, container) {
  // 内置渲染器，会自动传入 DOM api，专门给 vue 使用
  const renderer = createRenderer(renderOptions)

  renderer.render(vdnode, container)
}

export function isVNode(value) {
  return value ? value.__v_isVNode === true : false
}

/**
 * @param type 
 * @param props 
 * @param children 三种类型：数组，文本，null
 * @returns 
 */
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
    } else if (l === 3 && isVNode(children)) {
      // 子元素是虚拟节点，包一层
      children = [children]
    }
    return createVNode(type, propsOrChildren, children)
  }
}