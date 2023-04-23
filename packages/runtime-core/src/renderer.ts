
// 虚拟节点标识符
// 位运算比运算快，常见三种
// << 左移运算符（二进制补位0，后边数字移动位数）

import { EMPTY_OBJ, isArray, isObject, isString } from "@vue/shared"
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

  const mountElement = (vnode, container, anchor) => {
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
      mountChildren(vnode.children, el, null)
    }


    hostInsert(el, container, anchor)
  }

  const mountChildren = (children, container, anchor) => {
    for (let i = 0; i < children.length; i++) {
      // 子元素继续 patch
      patch(null, children[i], container, anchor)
    }
  }

  const unmount = vnode => {
    hostRemove(vnode.el)
  }

  const patchProps = (oldProps, newProps, el) => {
    // 1. 前后属性不一致，才会处理
    if (oldProps !== newProps) {
      // 2. 老的有值，新的没有，移除
      if (oldProps !== EMPTY_OBJ) {
        for (const key in oldProps) {
          // 2.1 老的有，新的无
          if (!(key in newProps)) {
            hostPatchProp(el, key, oldProps[key], null)
          }
        }
      }

      // 3. 遍历新的，新老比对
      for (const key in newProps) {
        const next = newProps[key]
        const prev = oldProps[key]

        hostPatchProp(el, key, prev, next)
      }

    }
  }

  const unmountChildren = children => {
    for (let i = 0; i < children.length; i++) {
      hostRemove(children[i])
    }
  }

  const patchKeyedChildren = (c1, c2, el) => {
    let i = 0
    const l2 = c2.length
    let e1 = c1.length - 1 // prev ending index
    let e2 = l2 - 1 // next ending index

    // 1. sync from start
    // (a b) c
    // (a b) d e
    // i = 2
    while (i <= e1 && i <= e2) {
      const n1 = c1[i]
      const n2 = c2[i]
      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, el)
      } else {
        break
      }
      i++
    }

    // 2. sync from end
    // a (b c)
    // d e (b c)
    // e1 = 0, e2 = 1
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1]
      const n2 = c2[e2]
      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, el)
      } else {
        break
      }
      e1--
      e2--
    }

    // 3. common sequence + mount
    // (a b)
    // (a b) c
    // i = 2, e1 = 1, e2 = 2
    // (a b)
    // c (a b)
    // i = 0, e1 = -1, e2 = 0
    if (i > e1) {
      if (i <= e2) {
        const nextPos = e2 + 1
        const anchor = nextPos < l2 ? c2[nextPos].el : null
        while (i <= e2) {
          patch(null, c2[i], el, anchor)
          i++
        }
      }
    }

    // 4. common sequence + unmount
    // (a b) c
    // (a b)
    // i = 2, e1 = 2, e2 = 1
    // a (b c)
    // (b c)
    // i = 0, e1 = 0, e2 = -1
    else if (i > e2) {
      while (i <= e1) {
        unmount(c1[i])
        i++
      }
    }

    // 5. unknown sequence
    // [i ... e1 + 1]: a b [c d e] f g
    // [i ... e2 + 1]: a b [e d c h] f g
    // i = 2, e1 = 4, e2 = 5
    else {
      const s1 = i
      const s2 = i

      // 5.1 build key:index map for newChildren
      const keyToNewIndexMap = new Map()
      for (i = s2; i <= e2; i++) {
        const nextChild = c2[i]
        if (nextChild.key != null) {
          keyToNewIndexMap.set(nextChild.key, i)
        }
      }

      // 5.2 loop through old children left to be patched and try to patch
      // matching nodes & remove nodes that are no longer present
      let j
      let patched = 0
      const toBePatched = e2 - s2 + 1
      let moved = false
      // usedto track whether any node has moved
      let maxNewIndexSoFar = 0
      // works as Map<newIndex, oldIndex>
      // Note that oldIndex is offset by +1
      // and oldIndex = 0 is a special value indicating the new node has
      // no corresponding old node.
      // used for determining longest stable subsequence
      const newIndexToOldIndexMap = new Array(toBePatched)
      for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0

      for (i = s1; i <= e1; i++) {
        const prevChild = c1[i]
        if (patched >= toBePatched) {
          // all new children have been patched so this can only be a removal
          unmount(prevChild)
          continue
        }
        let newIndex
        if (prevChild.key != null) {
          // when key = 'c', newIndex = 4(in new children)
          newIndex = keyToNewIndexMap.get(prevChild.key)
        } else {
          // key-less node, try to locate a key-less node of the same type

        }

        if (newIndex === undefined) {
          // remove old node which not in new children
          unmount(prevChild)
        } else {
          newIndexToOldIndexMap[newIndex - s2] = i + 1
          if (newIndex >= maxNewIndexSoFar) {
            maxNewIndexSoFar = newIndex
          } else {
            moved = true
          }
          patch(prevChild, c2[newIndex], el, null)
          patched++
        }
      }
      // 5.3 move and mount
      // looping backwards so that we can use last patched node as anchor
    }
  }

  const patchChildren = (n1, n2, el, anchor) => {
    const c1 = n1.children
    const c2 = n2.children


    const prevShapeFlag = n1 ? n1.shapeFlag : 0
    const shapeFlag = n2.shapeFlag

    /* 新元素是文本 */
    // 1. 新本文，老的数组，先移除老的
    // 2. 新文本，老文本/老空，更新文本

    /* 新元素是数组OR空 */
    // 3. 新数组，老数组，diff
    // 4. 新空，老数组，移除老的

    // 5. 老文本，先清空文本
    // 6. 新数组（老空，老文本），挂载

    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        unmountChildren(c1)
      }
      if (c1 !== c2) {
        hostSetElementText(el, c2)
      }
    } else {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // two arrays, do full diff
        patchKeyedChildren(c1, c2, el)
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        } else {
          unmountChildren(c1)
        }
      } else {
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          hostSetElementText(el, '')
        }
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(c2, el, anchor)
        }
      }
    }
  }

  const patchElement = (n1, n2, anchor) => {
    const el = n2.el = n1.el

    const oldProps = n1.props || {}
    const newProps = n2.props || {}

    patchProps(oldProps, newProps, el)
    patchChildren(n1, n2, el, anchor)
  }

  const patch = (n1, n2, container, anchor = null) => {
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
      mountElement(n2, container, anchor)
    } else {
      // diff 算法 - 前后元素一致
      patchElement(n1, n2, anchor)
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