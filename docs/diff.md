## Diff 算法

### 不同 VNode 元素比对

两个不同虚拟节点不需要进行比较，直接移除老节点，将新的虚拟节点渲染成真实 DOM 进行挂载即可

```js
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
    // diff 算法
  }
}
```

### 元素一致

前后元素一致则比较两个元素的属性和子节点
```js
const patchElement = (n1, n2) => {
  const el = n2.el = n1.el

  const oldProps = n1.props || {}
  const newProps = n2.props || {}

  patchProps(oldProps, newProps)
  patchChildren(n1, n2, el)
}
```

**patchProps**
```js
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
```

元素一致时，比对属性，引入 patchFlag，这个值是在 template 模板渲染代码中生成。

```js
export const enum PatchFlags {
  /**
   * Indicates an element with dynamic textContent (children fast path)
   */
  TEXT = 1,

  /**
   * Indicates an element with dynamic class binding.
   */
  CLASS = 1 << 1,

  /**
   * Indicates an element with dynamic style
   * The compiler pre-compiles static string styles into static objects
   * + detects and hoists inline static objects
   * e.g. `style="color: red"` and `:style="{ color: 'red' }"` both get hoisted
   * as:
   * ```js
   * const style = { color: 'red' }
   * render() { return e('div', { style }) }
   * ```
   */
  STYLE = 1 << 2,

  /**
   * Indicates an element that has non-class/style dynamic props.
   * Can also be on a component that has any dynamic props (includes
   * class/style). when this flag is present, the vnode also has a dynamicProps
   * array that contains the keys of the props that may change so the runtime
   * can diff them faster (without having to worry about removed props)
   */
  PROPS = 1 << 3,

  /**
   * Indicates an element with props with dynamic keys. When keys change, a full
   * diff is always needed to remove the old key. This flag is mutually
   * exclusive with CLASS, STYLE and PROPS.
   */
  FULL_PROPS = 1 << 4,

  /**
   * Indicates an element with event listeners (which need to be attached
   * during hydration)
   */
  HYDRATE_EVENTS = 1 << 5,

  /**
   * Indicates a fragment whose children order doesn't change.
   */
  STABLE_FRAGMENT = 1 << 6,

  /**
   * Indicates a fragment with keyed or partially keyed children
   */
  KEYED_FRAGMENT = 1 << 7,

  /**
   * Indicates a fragment with unkeyed children.
   */
  UNKEYED_FRAGMENT = 1 << 8,

  /**
   * Indicates an element that only needs non-props patching, e.g. ref or
   * directives (onVnodeXXX hooks). since every patched vnode checks for refs
   * and onVnodeXXX hooks, it simply marks the vnode so that a parent block
   * will track it.
   */
  NEED_PATCH = 1 << 9,

  /**
   * Indicates a component with dynamic slots (e.g. slot that references a v-for
   * iterated value, or dynamic slot names).
   * Components with this flag are always force updated.
   */
  DYNAMIC_SLOTS = 1 << 10,

  /**
   * Indicates a fragment that was created only because the user has placed
   * comments at the root level of a template. This is a dev-only flag since
   * comments are stripped in production.
   */
  DEV_ROOT_FRAGMENT = 1 << 11,

  /**
   * SPECIAL FLAGS -------------------------------------------------------------
   * Special flags are negative integers. They are never matched against using
   * bitwise operators (bitwise matching should only happen in branches where
   * patchFlag > 0), and are mutually exclusive. When checking for a special
   * flag, simply check patchFlag === FLAG.
   */

  /**
   * Indicates a hoisted static vnode. This is a hint for hydration to skip
   * the entire sub tree since static content never needs to be updated.
   */
  HOISTED = -1,
  /**
   * A special flag that indicates that the diffing algorithm should bail out
   * of optimized mode. For example, on block fragments created by renderSlot()
   * when encountering non-compiler generated slots (i.e. manually written
   * render functions, which should always be fully diffed)
   * OR manually cloneVNodes
   */
  BAIL = -2
}
```


**patchChildren**
```js
const patchChildren = (n1, n2, el) => {
  const c1 = n1.children
  const c2 = n2.children

  const prevShapeFlag = c1.shapeFlag
  const shapeFlag = c2.shapeFlag

  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    // 新元素是文本 | 老：数组、文本、空
    if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
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
```

### 子元素比对分类

| 新 | 老 | 操作 |
| -- | -- |  --  |
| 文本| 数组| 删除老的，设置文本内容  |
| 文本| 文本| 更新文本即可|
| 文本| 空  | 更新文本|
| 数组| 数组| diff 算法|
| 数组| 文本| 清空文本，挂载|
| 数组| 空  | 挂载|
| 空  | 数组| 删除所有子元素|
| 空  | 文本| 清空文本|
| 空  | 空  | 不用处理|

**pathchChildren**
```js
const patchChildren = (n1, n2, el) => {
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
        mountChildren(c2, el)
      }
    }
  }
}
```


### 最长递增子序列

**分析**
1. 运用二分查找和树的前驱节点追溯，Diff 算法中，通过前后同序列比较之后，确定出变化的部分。（`sync from start/end`）

2. 变化的部分再次比对，看是否挂载新元素、卸载老元素、patch新老元素、移动乱序的元素。

3. 移动乱序元素，采用的是最长递增子序列，最小程度移动元素，提升性能。

例如：
```js
old: ['a', 'b', 'c', 'd', 'e', 'f', 'g']
new: ['a', 'b', 'e', 'c', 'd', 'h', 'f', 'g']
如果只是倒叙插入法，即 f-> g, d -> f, c -> d, e -> c 上，这样就把ecd移动了三次
最长递增子序列，c d 顺序不变，只是将 e 移动到 c 前面即可。
```

**实现**
```js
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
```

getSequence
```js
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
 * 数值        value  下标  操作result
 * 2             2    0     无   [0]               
 * 2 3           3    1     追加 [0, 1]            
 * 1 3           1    2     替换2[2, 1]            
 * 1 3 5         5    3     追加 [2, 1, 3]         
 * 1 3 5 6       6    4     追加 [2, 1, 3, 4]       
 * 1 3 5 6 8     8    5     追加 [2, 1, 3, 4, 5]   
 * 1 3 5 6 7     7    6     替换8[2, 1, 3, 4, 6]   
 * 1 3 5 6 7 9   9    7     追加 [2, 1, 3, 4, 6, 7]
 * 1 3 4 6 7 9   4    8     替换5[2, 1, 8, 4, 6, 7]
 * 
 * looping backwards result
 * 索引：[0, 1, 3, 4, 6, 7]
 * 数组值：[2, 3, 5, 6, 8, 9]
 * 
 * result 存放拿出的索引值
 * p 用于存放，比其小的那一项索引值。初始值是输入的 arr
 * 核心：下一项记录前一项中的索引。最后从后往前找
 */
```
