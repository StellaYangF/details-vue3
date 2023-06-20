## runtime 相关

**vue 组成**
运行时和编译时
不要编译时，就是去掉模板变成函数的过程
运行时：core核心运行时（不依赖任何平台）dom（依赖某个平台，提供对应api）
    
vue -> runtime-dom -> runtime-core(虚拟dom) -> reactivity

### runtime-dom
`渲染器`的作用是把虚拟 DOM 渲染为特定平台上的真实元素。在浏览器中，渲染器会把虚拟 DOM 渲染成真实 DOM 元素

#### 操作节点
`runtime-dom/src/nodeOps` 存放常见 `DOM` 操作 `API`，不同运行时提供的具体实现不一样，最终将操作方法传递到 `runtime-core` 中，所以 `runtime-core` 不需要关心平台相关代码~
```js
const doc = typeof document !== 'undefined' ? document : null

export const nodeOps = {
  insert: (child, parent, anchor) => {
    parent.insertBefore(child, parent, anchor || null)
  },

  remove: child => {
    const parent = child.parentNode
    if (parent) {
      parent.removeChild(child)
    }
  },

  createElement: tag => doc.createElement(tag),

  createText: text => doc.createTextNode(text),

  createComment: text => doc.createComment(text),

  setText: (node, text) => {
    node.nodeValue = text
  },

  setElementText: (el, text) => {
    el.textContent = text
  },

  parentNode: node => node.parentNode,

  nextSibling: node => node.nextSibling,

  querySelector: selector => doc.querySelector(selector)
}
```

#### 比对属性方法
patchProps.ts
```js
export function patchProps(el, key, prevValue, nextValue) {
  if (key === 'class') {
    patchClass(el, nextValue)
  } else if (key === 'style') {
    patchStyle(el, prevValue, nextValue)
  } else if (key.test(/^on[^a-z]/)) {
    patchEvent(el, key, nextValue)
  } else {
    patchAttr(el, key, nextValue)
  }
}
```

#### 操作类名
```js
function patchClass(el: Element, value: string | null) {
  if (value == null) {
    el.removeAttribute('class')
  } else {
    // isSVG el.setAttribute('class', value)

    // directly setting className should be faster than setAttribute in theory
    // if this is an element during a transition, take the temporary transition
    // classes into account.  
    el.className = value
  }
}
```

#### 操作样式
```js
function patchStyle(el: Element, prev, next) {
  const style = (el as HTMLElement).style

  // add next style
  for (const key in next) {
    style[key] = next[key]
  }

  // remove previous style which not in next style
  for (const key in prev) {
    if (next[key] == null) {
      style[key] = null
    }
  }
}
```

#### 操作事件
```js
function createInvoker(initialValue) {
  // 动态换绑事件回调
  // el.addEventListener(name, nextValue) 
  // nextValue 直接传入，后续更改了回调，需要解绑再绑
  // el.addEventListener(name, invoker.value)
  const invoker = e => invoker.value(e)
  invoker.value = initialValue

  return invoker
}

interface Invoker extends EventListener {
  value: EventValue
}

type EventValue = Function | Function[]

function patchEvent(
  el: Element & { _vei?: Record<string, Invoker | undefined> },
  rawName: string,
  nextValue: EventValue | null
) {
  const invokers = el._vei || (el._vei = {})

  // cache
  const exsistingInvoker = invokers[rawName]

  if (nextValue && exsistingInvoker) {
    exsistingInvoker.value = nextValue
  } else {
    const name = rawName.slice(2).toLocaleLowerCase()

    if (nextValue) {
      // bind new event and cache
      const invoker = (invokers[rawName] = createInvoker(nextValue))
      el.addEventListener(name, invoker)
    } else if (exsistingInvoker) {
      // remove
      el.removeEventListener(name, exsistingInvoker)
      invokers[rawName] = undefined
    }
  }
}
```

#### 操作属性
```js
function patchAttr(el: Element, key: string, value: any) {
  if (value == null) {
    el.removeAttribute(key)
  } else {
    el.setAttribute(key, value)
  }
}
```

#### 创建渲染器
```js
```

### runtime-core

runtime-core 不关心运行平台

#### 虚拟节点shapeFlag
```js
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
```

#### createVNode method
```js
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
```

#### h method
```js
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
```

#### createRenderer
```js
export function createRenderer(options){
  const {
      insert: hostInsert,
      remove: hostRemove,
      patchProp: hostPatchProp,
      createElement: hostCreateElement,
      createText: hostCreateText,
      setText: hostSetText,
      setElementText: hostSetElementText,
      parentNode: hostParentNode,
      nextSibling: hostNextSibling,
    } = options
  const patch = (n1,n2,container) => {
      // 初始化和diff算法都在这里喲
  }
  const render = (vnode,container) =>{
      if(vnode == null){
          if(container._vnode){ } // 卸载
      }else{
          patch(container._vnode || null,vnode,container); // 初始化和更新
      }
      container._vnode = vnode;
  }
  return {
      render
  }
}
```

#### 挂载 DOM
```js
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
```

#### 卸载 DOM
```js
const unmount = vnode => {
  hostRemove(vnode.el)
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
```
