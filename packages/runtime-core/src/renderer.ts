
// 虚拟节点标识符
// 位运算比运算快，常见三种
// << 左移运算符（二进制补位0，后边数字移动位数）

import { EMPTY_OBJ, invokeArrayFns, isArray, isObject, isString } from "@vue/shared"
import { renderOptions } from "@vue/runtime-dom"
import { Fragment, Text } from "./vnode"
import { createComponentInstance, setupComponent } from "./component"
import { ReactiveEffect } from "@vue/reactivity"
import { queueJob } from "./scheduler"
import { hasPropsChanged, updateProps } from "./componentProps"

// >> 右移
export const enum ShapeFlags {
  ELEMENT = 1, // 元素
  FUNCTION_COMPONENT = 1 << 1, // 函数式组件
  STATEFUL_COMPONENT = 1 << 2, // 普通状态组件
  TEXT_CHILDREN = 1 << 3, // 子元素为文本
  ARRAY_CHILDREN = 1 << 4, // 子元素为数组
  SLOTS_CHILDREN = 1 << 5, // 组件插槽
  TELEPORT = 1 << 6, // 传送门组件
  SUSPENSE = 1 << 7, // 异步加载组件
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8, // keep-alive
  COMPONENT_KEPT_ALIVE = 1 << 9,
  COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTION_COMPONENT
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
    if (vnode.type === Fragment) {
      unmountChildren(vnode.children)
    } else {
      hostRemove(vnode.el)
    }
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
      unmount(children[i])
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
          keyToNewIndexMap.set(nextChild.key, i) // { e: 2, d: 3, c: 4, h: 5 }
        }
      }

      // 5.2 loop through old children left to be patched and try to patch
      // matching nodes & remove nodes that are no longer present
      let j
      let patched = 0
      const toBePatched = e2 - s2 + 1 // 需要被 patch 的个数，供后续 newIndexToOldIndexMap 初始化用
      // used to track whether any node has moved
      // 即最长递增子序列，0 表示新增的，在标记下标时注意区分（+1）
      const newIndexToOldIndexMap = new Array(toBePatched).fill(0)
      // for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0

      for (i = s1; i <= e1; i++) {
        const prevChild = c1[i]
        if (patched >= toBePatched) {
          // all new children have been patched so this can only be a removal
          unmount(prevChild)
          continue
        }
        let newIndex
        newIndex = keyToNewIndexMap.get(prevChild?.key)

        if (newIndex === undefined) {
          unmount(prevChild) // 新的有，老的无，移除
        } else {
          // 新元素对应老元素的索引值 + 1，（+1是为了区分新增值如h ）
          // [e, d, c, h] -> 初始态[0, 0, 0, 0] -> 在老数组中对应的下标 [4 + 1, 3 + 1, 2 + 1, 0]
          newIndexToOldIndexMap[newIndex - s2] = i + 1
          patch(prevChild, c2[newIndex], el, null)
          patched++
        }
      }
      // 5.3 move and mount

      // 实现一：直接倒序插入，这样性能不太好，如果有增续，可以不变，乱序追加即可
      // for (let i = toBePatched; i > 0; i--) {
      //   const nextIndex = s2 + i
      //   const nextChild = c2[nextIndex]
      //   const anchor = nextIndex + 1 < c2.length ? c2[nextIndex + 1].el : null
      //   if (newIndexToOldIndexMap[i] == 0) {
      //     patch(null, nextChild, el, anchor)
      //   } else {
      //     hostInsert(nextChild.el, el, anchor)
      //   }
      // }

      // 实现二：最长递增子序列 [5, 4, 3, 0]
      const increasingNewIndexSequence = getSequence(newIndexToOldIndexMap);
      console.log(increasingNewIndexSequence)
      j = increasingNewIndexSequence.length - 1;
      for (i = toBePatched - 1; i >= 0; i--) {
        let currentIndex = i + s2; // 找到h的索引
        let child = c2[currentIndex]; // 找到h对应的节点
        let anchor = currentIndex + 1 < c2.length ? c2[currentIndex + 1].el : null; // 第一次插入h 后 h是一个虚拟节点
        if (newIndexToOldIndexMap[i] == 0) {
          // 新增节点
          patch(null, child, el, anchor)
        } else {
          // 当前元素不在递增序列中
          // OR 无递增序列，如：reverse
          if (i != increasingNewIndexSequence[j] || j < 0) {
            hostInsert(child.el, el, anchor);
          } else {
            j--; // 跳过不需要移动的元素， 为了减少移动操作 需要这个最长递增子序列算法  
          }
        }
      }
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
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          patchKeyedChildren(c1, c2, el)
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

  const patchElement = (n1, n2) => {
    const el = n2.el = n1.el

    const oldProps = n1.props || {}
    const newProps = n2.props || {}

    patchProps(oldProps, newProps, el)
    patchChildren(n1, n2, el, null)
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

    const { type, shapeFlag } = n2
    switch (type) {
      case Text:
        processText(n1, n2, container, anchor)
        break
      case Fragment:
        processFragment(n1, n2, container, anchor)
        break
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(n1, n2, container, anchor)
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          processComponent(n1, n2, container, anchor)
        }
    }
  }

  const processText = (n1, n2, container, anchor) => {
    if (n1 == null) {
      hostInsert(
        n2.el = hostCreateText(n2.children as string),
        container,
        anchor)
    } else {
      const el = (n2.el = n1.el!)
      if (n2.children !== n1.children) {
        hostSetText(el, n2.children as string)
      }
    }
  }

  const processFragment = (n1, n2, container, anchor) => {
    if (n1 == null) {
      mountChildren(n2.children, container, anchor)
    } else {
      patchChildren(n1, n2, container, anchor)
    }
  }

  const processElement = (n1, n2, container, anchor) => {
    if (n1 == null) {
      mountElement(n2, container, anchor)
    } else {
      patchElement(n1, n2)
    }
  }

  const processComponent = (n1, n2, container, anchor) => {
    if (n1 == null) {
      mountComponent(n2, container, anchor)
    } else {
      updateComponent(n1, n2)
    }
  }

  const mountComponent = (initialVNode, container, anchor) => {
    // 创建实例
    const instance = (initialVNode.component = createComponentInstance(initialVNode))
    // 给实例赋值,data => reactive
    setupComponent(instance)
    // 创建 renderEffect 并更新渲染
    setupRenderEffect(instance, container, anchor)
  }

  const setupRenderEffect = (instance, container, anchor) => {
    const { render } = instance

    const componentUpdateFn = () => {
      if (!instance.isMounted) {

        const { bm, m } = instance
        bm && invokeArrayFns(bm)

        const subTree = render.call(instance.proxy, instance.proxy)
        patch(null, subTree, container, anchor)
        m && invokeArrayFns(m)
        instance.subTree = subTree
        instance.isMounted = true
      } else {
        // updateComponent 属性变化或slots变化，均手动触发 instance.update
        // 运行的是当前的 effect，再次触发此 effect。跳过循环操作（activeEffect !== effect）。
        let { next, bu, u } = instance
        if (next) {
          next && updateComponentPreRender(instance, next)
        }
        bu && invokeArrayFns(bu)
        const subTree = render.call(instance.proxy, instance.proxy)
        patch(instance.subTree, subTree, container, anchor)
        u && invokeArrayFns(u)
        instance.subTree = subTree
      }
    }

    const effect = (instance.effect = new ReactiveEffect(
      componentUpdateFn,
      () => queueJob(update) // 控制 componentUpdateFn 执行时机，可以批处理
    ))

    const update = instance.update = effect.run.bind(effect)

    update()
  }

  function updateComponentPreRender(instance, next) {
    instance.next = null
    instance.vnode = next
    updateProps(instance.props, next.props)
  }

  const shouldUpdateComponent = (n1, n2) => {
    const { props: prevProps, children: prevChildren } = n1
    const { props: nextProps, children: nextChildren } = n2

    if (prevChildren || nextChildren) return true

    if (prevProps === nextProps) return false

    return hasPropsChanged(prevProps, nextProps)
  }

  const updateComponent = (n1, n2) => {
    const instance = (n2.component = n1.component)
    if (shouldUpdateComponent(n1, n2)) {
      instance.next = n2
      instance.update()
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

export function render(vnode, container) {
  // 内置渲染器，会自动传入 DOM api，专门给 vue 使用
  const renderer = createRenderer(renderOptions)

  renderer.render(vnode, container)
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
    shapeFlag
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

// https://en.wikipedia.org/wiki/Longest_increasing_subsequence
// 最长递增子序列
// 二分查找 + 贪心算法
function getSequence(arr: number[]): number[] {
  const p = arr.slice()
  // 类似数组副本，存放每一项比其大的那个值对应的下标
  // 如：[1,2,3,] p -> [1, 0, 1] 第一项由于没人和他比对，还是他自己
  const result = [0]
  // 存放追加值前面的索引，贪心算法

  let i, j, u, v, c
  const len = arr.length

  for (i = 0; i < len; i++) {
    const arrI = arr[i]
    // 0 表示新增元素，不处理
    if (arrI !== 0) {
      j = result[result.length - 1]
      // 1. 当前元素>取出的最大元素，追加入result，并记录下标
      if (arrI > arr[j]) {
        p[i] = j
        result.push()
        continue
      }

      // 2. 二分查找，第一个比arrI大的值
      u = 0
      v = result.length - 1
      while (u < v) {
        c = (u + v) >> 1 // 取中间值
        if (arrI > arr[result[c]]) {
          u = c + 1
        } else {
          v = c
        }
      }
      // 3. 找到中间值，result 中替换掉，第一个比arrI大的那个值，对应的下标
      // 同时在 p 中记录，result 中被替换值的前一项。
      // 贪心算法：最终 p 数组中记录的都是，原数组中每一项第一个比他大的值的下标
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1] // 记录前一项
        }
        result[u] = i
      }
    }
  }
  // 前驱子节点追溯，倒序查找
  u = result.length
  v = result[u - 1]
  while (u-- > 0) {
    result[u] = v
    v = p[v]
  }
  return result
}

/**
 * 例如：[2, 3, 1, 5, 6, 8, 7, 9, 4]
 * 输出：[0, 1, 3, 4, 6, 7] 索引值 -> 数值 [2, 3, 5, 6, 9]
 * O(n log n)
 * 
 * 迭代arr流程：
 * 数值        value  下标  操作result                操作p
 * 2             2    0     无   [0]                    [2, 3, 1, 5, 6, 8, 7, 9, 4]
 * 2 3           3    1     追加 [0, 1]                 [2, 0, 1, 5, 6, 8, 7, 9, 4]
 * 1 3           1    2     替换2[2, 1]                 [2, 0, 1, 5, 6, 8, 7, 9, 4]
 * 1 3 5         5    3     追加 [2, 1, 3]              [2, 0, 1, 1, 6, 8, 7, 9, 4]
 * 1 3 5 6       6    4     追加 [2, 1, 3, 4]           [2, 0, 1, 5, 6, 8, 7, 9, 4] 
 * 1 3 5 6 8     8    5     追加 [2, 1, 3, 4, 5]        [2, 0, 1, 5, 6, 8, 7, 9, 4]
 * 1 3 5 6 7     7    6     替换8[2, 1, 3, 4, 6]        [2, 0, 1, 5, 6, 8, 7, 9, 4]
 * 1 3 5 6 7 9   9    7     追加 [2, 1, 3, 4, 6, 7]     [2, 0, 1, 5, 6, 8, 7, 6, 4]
 * 1 3 4 6 7 9   4    8     替换5[2, 1, 8, 4, 6, 7]     [2, 0, 1, 5, 6, 8, 7, 6, 1]
 * 
 * looping backwards result
 * 索引：[0, 1, 3, 4, 6, 7]
 * 数组值：[2, 3, 5, 6, 8, 9]
 * 
 * result 存放拿出的索引值
 * p 用于存放，比其小的那一项索引值。初始值是输入的 arr
 * 核心：下一项记录前一项中的索引。最后从后往前找
 */
