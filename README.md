# Vue3 Handwriting

## Init 初始化

包管理工具为 `pnpm workspace`, 用以实现  `monorepo` (pnpm是快速、节省磁盘空间的包管理器。主要采用符号链接的方式管理模块)

```cmd
全局安装 pnpm
npm install pnpm -g

初始化项目
pnpm init -y
```

## Add Dependencies

```cmd
pnpm install typescript rollup rollup-plugin-typescript2 @rollup/plugin-json @rollup/plugin-node-resolve @rollup/plugin-commonjs minimist execa@4 esbuild   -D -w

```

1. 基于 typescript 开发，配置 tsconfig 文件
```js
pnpm tsc --init

// 生成如下代码 tsconfig.json
{
  "compilerOptions": {
    "outDir": "dist",
    "sourceMap": true,
    "target": "ES2016",
    "newLine": "lf",
    "useDefineForClassFields": false,
    "module": "ESNext",
    "moduleResolution": "node",
    "allowJs": false,
    "strict": false,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "jsx": "preserve",
    "lib": [
      "ESNext",
      "DOM"
    ],
    // 配置当前项目引入路径别名(reactivity引入shared方法，可直接 import from "@vue/shared")
    "baseUrl": ".",
    "paths": {
      "@vue/*": [
        "package/*/src"
      ]
    }
  }
}
```

## Structure 工作目录

- packages
  - reactivity 
    - src
    - package.json （`pnpm init `生成）
  - shared
    - src
- sc

## Reactive Package

### 数据代理
`vue3` 是基于 `Proxy` 实现，而 `vue2` 是基于 `Object.defineProperty``。注意，Proxy` 搭配 `Reflect` 实现，用以解决 `this` 调用时指向问题。

```js
const school = {
  students: 100,
  teachers: 200,
  get total() {
    return this.students + this.teachers
  }
}

const p = new Proxy(school, {
  get(target, key, receiver) {
    console.log(`Get ${key} ----`)
    // return target[key]

    // 绑定 school.total 取值(this.students + this.teachers)时内部的 this 会绑定为代理后的 p 对象 
    return Reflect.get(target, key, receiver)
  },
  set(target, key, value, receiver) {
    console.log(`Set ${key} ----`)
    return target[key] = value
  }
})

console.log(p.total)

/**
 * Proxy 不用 Reflect 时，则只会触发 total 在代理取值时的操作，this指向的是 school
 * Get total ----
 * 300
 * 
 * 使用 Reflect 时，this 则指向代理对象 p
 * Get total ----
 * Get students ----
 * Get teachers ----
 * 300
 */
```

### 特殊数据代理处理

分三种情况：非对象，重复代理，被代理过的对象

```js
  // target 值不同，处理方式如下：
  // 1. 非对象不代理
  if (!isObject(target)) return target

  // 2. 重复代理
  let existingProxy = reactiveMap.get(target)
  if (existingProxy) {
    return existingProxy
  }

  // 3. 代理后对象
  // 只有被代理的对象
  if (target[ReactiveFlags.IS_REACTIVE]) {
    return target
  }
```

### effect 函数执行

1. 如何关联正在执行的 effect 和响应式数据的取值
  - `effect.ts` 暴露出变量 `activeEffect`
  - `get` 取值操作时，通过变量 `activeEffect` 就建立起连接 `{target -> key -> dep}`
  - **每执行完一个 effect(fn)，就要清空当前的 activeEffect；而执行前，把 reactiveEffect 实例复制给 activeEffect**，这样才能保证fn执行时，内部用到的响应式数据，可以建立连接
  ![activeEffect](./assets/activeEffect.jpg)

2. 每调用一次 effect，就会重新 new 一个 `ReactiveEffect`
  - 嵌套 effect 需要考虑在内。
  ![nestedEffect](./assets/nestedEffect.jpg)
  - 解决方案 2.x 基于栈来处理（进出栈），需要额外维护。
  - vue3 则运用树结构，标记关系即可。
  ![nestedEffectParent](./assets/nestedEffectParent.jpg)

### 依赖收集
默认执行 effect 时会对属性，进行依赖收集

- effect 函数内取值，才会 
- `activeEffect.deps` 将属性和对应的 `effect` 维护成映射关系，后续属性变化可以触发对应的 `effect` 函数重新 `run`
![track](./assets/track.jpg)

### 触发更新
取值时已收集过依赖，更新操作即触发 effect 重新执行
![trigger](./assets/trigger.jpg)

### 清除 effect 产生的副作用

flag 动态收集依赖（如下），就需要清除依赖
```js
import { reactive, effect } from './index.js'
    
const state = reactive({ flag: true, name: 'Stella', age: 18, address: 'Wuhan' })
effect(() => {
  console.log('effect exec')

  // 1. flag 为true，取值逻辑只有 name 没有 age，effect 只与 name 建立 connection
  app.innerHTML =  state.flag
    ? 'Name: ' + state.name
    : 'Age: ' + state.age
})

setTimeout(() => {
  // 此处 flag 设置为 false，触发 effect，取值只会取 age，前面 name 取值收集的依赖应该清除
  state.flag = false
  
  setTimeout(() => {
    // 修改 name，不应触发 effect 函数执行
    state.name ='Yang'
  }, 1000)
}, 1000)

```

更新操作时，会触发收集的 effect 执行，执行前应将此前收集的（取消绑定的）effect 清除掉
```js
class ReactiveEffect {
  private parent
  active = true
  // 记录 effect 中使用的属性
  deps = []
  constructor(private fn) { }

  run() {
    try {
      this.parent = activeEffect
      activeEffect = this
      // 清理收集的 effect +
      cleanupEffect(this)
      this.fn()
    } finally {
      activeEffect = this.parent
      this.parent = undefined
    }
  }

  stop() { }
}

function cleanupEffect(effect) {
  const { deps } = effect

  for (let i = 0; i < deps.length; i++) {
    deps[i].delete(effect)
  }
  effect.deps.length = 0
}

export function trigger(target, type, key, value, oldValue) {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    return
  }

  const deps = depsMap.get(key) || new Set()
  /** +++++++
   * 直接操作 effects 会导致死循环
   * 解决：应改为副本，再迭代操作
   * 
   * { name: Set[e1, e2] }
   * { age: Set[e2, e3] }
   */

  const effects = [...deps]
  effects && effects.forEach(effect => {
    if (effect !== activeEffect) {
      effect.run()
    }
  });

}
```

### Stop Effect
默认响应式数据，是自动更新的。而某些场景，是需要用户手动更新 effect，即 forceUpdate

1. `effect` 调用后，会返回一个对象 `runner` ，挂在了 `effect` 实例对象
2. `runner` 就是 `run` 方法
3. 调用 `stop` 后，再次修改 `state` 不会触发更新
4. 停止 effect 之后，需要清理收集的依赖，并将 ReactiveEffet.active 变为失活状态
5. 调用 runner 方法，判断 active 是否失活，不走依赖收集，直接调用 fn

用法
```js
    const state = reactive({  name: 'Stella' })
    
    const runner = effect(() => {
      app.innerHTML = state.name
    })

    runner()
    
    // 清理依赖
    runner.effect.stop()

    // 失活后，任然可以调用，手动更新
    state.name = 'yang'
    runner() 

```

### 调度执行 scheduler
`effect` 方法，内部传入 `scheduler` 方法，可以在数据变化时，自行操作 `run`
`trigger` 触发时，我们可以自己决定副作用函数执行的时机、次数、及执行方式

```js
// effect.ts function trigger() {}
 effects && effects.forEach(effect => {
    // 防止再次执行的 effect
    if (effect !== activeEffect) {
      // 执行用户传入 scheduler
      if (effect.scheduler) {
        effect.scheduler()
      } else {
        effect.run()
      }
    }
  });
```

### 深度代理

state 属性对应的对象，也需要深度代理
```js
// baseHandlers.ts function mutableHandlers() {}
  get(target, key, receiver) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return true
    }

    // 深度代理
    const res = Reflect.get(target, key, receiver)
    if (isObject(res)) {
      return reactive(res)
    }

    // 取值关联 target, key 和 effect
    track(target, 'get', key)

    return res
  },
```

## watch Method

### watch
`Vue` 框架，分包管理。`watch` 的大致关系为 `vue` -> `runtime-dom` -> `reactivity`

watch 内部就是 new 一个 `ReactiveEffect`，传入 fn 和 `scheduler`，fn 包装成 getter，触发取值操作，数据变化时，自行执行 `scheduler`

### watchEffect
watchEffect 本质就是一个 effect，默认是异步执行；
watch 是监控一个数据的变化，数据更新执行 effect

```js
// effect + scheduler 取值操作，收集依赖，并将前后取值返回
export function watch(source, cb, options) {
  doWatch(source, cb, options)
}

// watchEffect 本质是一个 effect
export function watchEffect(source, options) {
  doWatch(source, null, options)
}

/** 
* 不同点：
* 1. 参数一：watch 两种传参方式（对象 or 函数返回值取值），即 getter
* 2. 参数二：watch 数据更新的回调函数。watchEffect 是 options，没有

* 相同点：
* 1. 默认都是异步执行操作
* 2. 参数三，可传入 flush 参数，取消异步执行时机
*/
export function doWatch(source, cb, options) {
  // 1. source 是响应式对象
  // 2. source 是一个函数
  // 3. ReactiveEffect fn 为取值操作，() => 自动触发操作

  let getter;
  if (isReactive(source)) {
    getter = traverse(source)
  } else if (isFunction(source)) {
    // watchEffect 传入的就是包含取值操作的函数，new ReactiveEffect 时取值收集依赖
    getter = source
  }

  let oldValue

  const scheduler = () => {
    if (cb) {
      // watch 函数，第二个参数
      const newValue = effect.run()
      cb(newValue, oldValue)
      oldValue = newValue
    } else {
      // watchEffect 则是直接帮忙执行 source 方法，等同于 effect 方法
      effect.run()
    }
  }

  // watch 和 watchEffect 复用 new ReactiveEffect，传入 scheduler
  // scheduler 根据是否传入 cb，
  const effect = new ReactiveEffect(getter, scheduler)

  // 先触发取值，收集依赖，保存 getter 返回的值
  oldValue = effect.run()
}
```

### watch cleanup


背景
**场景**：用户输入框中，输入信息查询，后端数据返回时间问题，会导致返回数据渲染问题。
**方案**：
  1. 取消请求
  2. 清理定时器
  3. 屏蔽数据（类似防抖操作，最新请求发出时，丢弃上次请求返回值）
**代码解决**
  1. `vue2` 中需要自行解决
  2. `vue3` 提供 `onCleanup` 回调函数
  ```js
  // mock backend response
    let time = 3000
    function getData(input) {
      return new Promise(resolve => {
        setTimeout(() => resolve(input), time -= 1000)
      })
    }

    const state = reactive({ name: 'Stella', age: 18 })

    let arr = []
    watch(() => state.age, async function callback (newVal, oldVal, onCleanup) {
      // 屏蔽返回的数据，不进行更新

      // vue2 处理方式
      // 闭包：函数的创建和执行不在一个作用域。
      // debugger 
      // 通过代码调试：
      // 每次更新age值，都会触发 callback 执行，getData 返回的数据需要等待时间
      // 类似防抖操作，下一次请求操作发出时，丢弃上次的返回值

      while(arr.length > 0) {
        let fn = arr.shift()
        fn()
      }

      let flag = true
      arr.push(() => flag = false )
      // vue3 提供 onCleanup
      // let flag = true
      // onCleanup(() => flag = false)

      const res = await getData(newVal)
      flag && (app.innerHTML = res)
    })

    // 不用 setTimeout 默认批量更新
    const timer1 = setTimeout(() => state.age = 19) // 3s后返回
    const timer2 = setTimeout(() => state.age = 20) // 2s后返回
    const timer3 = setTimeout(() => state.age = 21) // 1s后返回 newVal
  ```

vue3 实现
```js
// apiWatch.ts

let cleanup;
const onCleanup = fn => {
  cleanup = fn
}
const scheduler = () => {
  if (cleanup) cleanup()

  if (cb) {
    const newValue = effect.run()
    cb(newValue, oldValue, onCleanup)
    oldValue = newValue
  } else {
    effect.run()
  }
}
```

## computed

### 计算属性特点
1. 主要是根据其他数据进行衍生数据
2. 懒执行，若依赖的值不发生变化，不会重新执行，dirty 缓存
  ```js
    const state = reactive({ firstname: 'Stella', lastname: 'Yang' })

    const fullname = computed({
      get() {
        // 读取多次，get 取值器只会触发一次，数据dirty，再次读取再次触发
        console.log('get fullname')
        return state.firstname + ' ' +  state.lastname
      }, 
      set() {

      }
    })

    
    app.innerHTML = fullname.value
    fullname.value
    fullname.value
    fullname.value
  

    state.firstname = 'Fan'
  ```
3. 自身无法修改
4. 依赖的数据变化，后续再取值会获取新值，不是 effect 不会触发更新，再次取值获取新值
5. 返回 `ComputedRefImpl`，自行收集依赖、触发 effect 执行

### 代码实现
![computed](./assets/computed.png)

## ref 相关

### 背景 ref
1. `proxy` 代理的目标必须是非原始值，所以 `reactive` 不支持原始值类型
2. `Ref` 将原始值类型进行包装
3. 返回 `RefImpl` 进行管理
4. 访问器属性，取值和更新时，收集依赖与触发更新操作
5. 区分 ref 和 shallowRef，单层代理

### 代码实现
![ref](./assets/ref.png)

### toRef(s)

代理对象结构之后，会丢失响应式更新操作。可通过 toRef(s) 实现

![toRef](./assets/toRef.png)

### proxyRefs

自动去掉 ref.value，template 模板帮忙做了操作
![proxyRefs](./assets/proxyRefs.png)


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

## 组件渲染原理

### Text, Fragment 渲染

除 VNode 之外，Vue3 中还有很多其他类型的虚拟节点，如：Text, Fragment

```js
export const Text = Symbol.for('v-text')
export const Fragment = Symbol.for('v-fgt') as any as {
  __isFragment: true,
  new(): {
    $props: any
  }
}
```

### 文本

```js
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
      } else if (shapeFlag & ShapeFlags.COMPOENNT) {
        processComponent(n1, n2, container, anchor)
      }
  }
}
```

```js
render(h(Text, 'Hello'), document.getElementById('app'))
```

```js
const processText = (n1, n2, container, anchor) => {
  if (n1 === null) {
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
```

### Fragment
为了让 Vue3 支持**多根节点**模板，Vue.js 提供 Fragment 来实现，核心就是一个**无意义的标签包裹多个节点**。

```js
render(h(Fragment, [h('span', 'Hello'), h('span', ' Stella')]), document.getElementById('app'))
```

```js
const processFragment = (n1,n2,container)=>{
    if(n1 == null){ 
        mountChildren(n2.children,container);
    }else{
        patchChildren(n1,n2,container);
    }
}
```

**卸载元素时，特殊处理下 fragment，删除其子元素**
```js
const unmount = vnode => {
  if (vnode.type === Fragment) {
    unmountChildren(vnode.children)
  } else {
    hostRemove(vnode.el)
  }
}
```

```js
const unmountChildren = children => {
  for (let i = 0; i < children.length; i++) {
    unmount(children[i])
  }
}
```

### 组件渲染
组件需要提供一个 render 函数，渲染函数需要返回虚拟 DOM

**方法列表**
- h => 传入 VueComponent 对象
  - data: function(){ return {...} }
  - render: function(): vnode{ return h() }，可接收 proxy 代理对象
- createVNode => type 参数为对象，ShapeFlags.STATEFUL_COMPONENT，返回 vnode
- render
- patch => shapeFlag 为 COMPONENT 类型
- processComponent
- mountComponent
- updateComponent
- createComponentInstance
- createAppContext
- setupRenderEffect
- updateComponentPreRender

```js
const VueComponent = {
  data() {
    return { name: 'Stella' }
  },
  render(proxy) {
    // 源码中，调用 render.call(proxy, proxy)
    // proxy === this
    return h('p', [h('div'), `Hello, I'm ${this.name}.`, h('div', `I love coding and dancing.`)])
  },
  
}

render(h(VueComponent), app)
```

**添加组件类型**
h 方法中传入一个对象说明要渲染的是一个组件。（后续还有其他可能）
```js
export const createVNode = (type, props, children = null) => {
const shapeFlag = isString(type)
  ? ShapeFlags.ELEMENT
  : isObject(type)
    ? ShapeFlags.STATEFUL_COMPONENT
    : 0
    // ... 稍后可以根据类型来进行组件的挂载
}
```

**组件渲染**
```js
const processComponent = (n1, n2, container, anchor) => {
  if (n1 == null) {
    mountComponent(n2, container, anchor)
  } else {
    updateComponent(n1, n2)
  }
}

const mountComponent = (initialVNode, container, anchor) => {
  const instance = (initialVNode.component = createComponentInstance(initialVNode))
  setupRenderEffect(instance, initialVNode, container, anchor)
}

const setupRenderEffect = (instance, initialVNode, container, anchor) => {
  const { render, data = () => { } } = initialVNode.type
  const state = reactive(data())

  const componentUpdateFn = () => {
    if (!instance.isMounted) {
      // render() { return h() }
      const subTree = render.call(state, state)
      patch(null, subTree, container, anchor)
      instance.subTree = subTree
      instance.isMounted = true
    } else {
      const subTree = render.call(state, state)
      patch(instance.subTree, subTree, container, anchor)
      instance.subTree = subTree
    }
  }

  const effect = (instance.effect = new ReactiveEffect(componentUpdateFn))

  const update = instance.update = effect.run.bind(effect)

  update()
}
```

**组件异步渲染**
setupRenderEffect 中修改调度方法，将更新方法压入到队列中,批量处理
```js
const effect = (instance.effect = new ReactiveEffect(
  componentUpdateFn,
  () => queueJob(update)
))

const update = instance.update = effect.run.bind(effect)
```

批量处理 scheduler.ts

```js
const queue = []
let isFlushing = false
const resolvedPromise = Promise.resolve()

// 防止一更新数据就触发更新,批量处理
export function queueJob(job) {
  if (!queue.includes(job)) {
    // 一个组件依赖的多个数据时，多数据更新,任务队列中只会压入一次
    queue.push(job)
  }

  // 数据更新，可能会出现多个组件更新，采用队列存储
  if (!isFlushing) {
    isFlushing = true
    // promise 微任务，等当前同步任务执行完成后，再执行
    resolvedPromise.then(() => {
      isFlushing = false
      const copy = queue.slice()
      // 这里要先清空，防止在执行过程中在加入新的job，直到当前job都执行完，再开始新一轮任务
      queue.length = 0
      copy.forEach(job)
      copy.length = 0 // 执行完，清空副本
    })
  }

}

//类似浏览器的事件环：(同步任务, 微任务, 宏任务)
// 一轮一轮，执行过程中还会新增新的任务，先缓存入队列中
```

**组件Props、Attrs 实现**
`Props` 和 `Attrs` 关系是：没有定义在 `component.props` 中的属性将存储到 `attrs` 对象中
```js
const VueComponent = {
  data() {
    return { name: 'Stella', age: 18 }
  },
  props: {
    address: String
  },
  render() {
    return h('p', [h('div', `Hello, I'm ${this.name}, ${this.age} years old.`), h('div', `props & attrs: ${this.address}, ${this.$attrs.a}, ${this.$attrs.b}`)])
  },
  
}

render(h(VueComponent, { address: 'Wuhan', a: 1, b: 1 }), app)
```

**initProps**
```js
const mountComponent = (initialVNode, container, anchor) => {
  // 创建实例
  const instance = (initialVNode.component = createComponentInstance(initialVNode))
  // 给实例赋值,data => reactive
  setupComponent(instance)
  // 创建 renderEffect 并更新渲染
  setupRenderEffect(instance, container, anchor)
}
```

**componentProps.ts**
```js
export function initProps(
  instance,
  rawProps
) {
  const props = {}
  const attrs = {}
  // 获取组件 用户的配置
  const options = instance.propsOptions || {} // VueComponent.type.props

  if (rawProps) {
    for (let key in rawProps) {
      const value = rawProps[key]
      if (key in options) {
        props[key] = value
      } else {
        attrs[key] = value
      }
    }
  }

  instance.props = reactive(props); // 这里应该用shallowReactive，遵循单向数据流原则
  instance.attrs = attrs
}
```

**属性代理**
```js
export const PublicInstanceProxyHandlers = {
  get(target, key) {
    const { data, props } = target
    if (data && hasOwn(data, key)) {
      return data[key]
    } else if (hasOwn(props, key)) {
      return props[key]
    }
    // $attrs
    const publicGetter = publicPropertiesMap[key]
    if (publicGetter) {
      return publicGetter(target)
    }
  },
  set(target, key, value) {
    const { data, props } = target
    if (data && hasOwn(data, key)) {
      data[key] = value
      return true
    } else if (hasOwn(props, key)) {
      console.warn(`Attempting to mutate prop "${key}". Props are readonly.`)
      return false
    }
    return true
  }
}
```

**组件流程整合**

```js
const mountComponent = (initialVNode, container, anchor) => {
  // 创建实例
  const instance = (initialVNode.component = createComponentInstance(initialVNode))
  // 给实例赋值,data => reactive
  setupComponent(instance)
  // 创建 renderEffect 并更新渲染
  setupRenderEffect(instance, container, anchor)
}
```


**1）创建组件实例**
```js

export function createAppContext() {
  return {
    app: null,
    config: {
      isNativeTag: NO,
      performance: false,
      globalProperties: {},
      optionMergeStrategies: {},
      errorHandler: undefined,
      warnHandler: undefined,
      compilerOptions: {}
    },
    mixins: [],
    components: {},
    directives: {},
    provides: Object.create(null),
    optionsCache: new WeakMap(),
    propsCache: new WeakMap(),
    emitsCache: new WeakMap()
  }
}

const emptyAppContext = createAppContext()

let uid = 0
export type Data = Record<string, unknown>

export function createComponentInstance(vnode) {
  const type = vnode.type
  const appContext = emptyAppContext

  const instance = {
    uid: uid++,
    vnode, // 组件的虚拟节点
    type,
    appContext,
    isMounted: false,
    subTree: null!, // 要渲染的子节点
    update: null!, // creation 后同步设置
    // state
    data: EMPTY_OBJ,
    props: EMPTY_OBJ, // 父组件传入的 props
    attrs: EMPTY_OBJ, // 子组件没有定义 props,会放入 $attrs中
    proxy: null, // 代理对象
    propsOptions: vnode.type.props // VueComponent.type 为一个对象
  }

  return instance
}
```


**2）设置组件属性**
```js
export function setupComponent(instance) {
  const { props, type } = instance.vnode
  initProps(instance, props)
  instance.proxy = new Proxy(instance, PublicInstanceProxyHandlers)
  const data = type.data
  if (data) {
    if (!isFunction(data)) return console.warn(`The data option must be a function`)
    instance.data = reactive(data.call(instance.proxy))
  }

  instance.render = type.render
}

export const PublicInstanceProxyHandlers = {
  get(target, key) {
    const { data, props } = target
    if (data && hasOwn(data, key)) {
      return data[key]
    } else if (hasOwn(props, key)) {
      return props[key]
    }
    // $attrs
    const publicGetter = publicPropertiesMap[key]
    if (publicGetter) {
      return publicGetter(target)
    }
  },
  set(target, key, value) {
    const { data, props } = target
    if (data && hasOwn(data, key)) {
      data[key] = value
      return true
    } else if (hasOwn(props, key)) {
      console.warn(`Attempting to mutate prop "${key}". Props are readonly.`)
      return false
    }
    return true
  }
```

**3）渲染effect**
```js
const setupRenderEffect = (instance, container, anchor) => {

  const { render } = instance

  const componentUpdateFn = () => {
    if (!instance.isMounted) {
      // render() { return h() }
      // 返回的就是 vnode
      const subTree = render.call(instance.proxy, instance.proxy)
      patch(null, subTree, container, anchor)
      // 方便再次挂载时，前后 vnode 进行比对
      instance.subTree = subTree
      // 挂载后修改 isMounted 值
      instance.isMounted = true
    } else {
      // 用户传入的 render 方法可以接收 reactive 返回的代理对象
      const subTree = render.call(instance.proxy, instance.proxy)
      patch(instance.subTree, subTree, container, anchor)
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
```

**属性更新**
```js
const cm1 = {
  props: {
    address: String
  },
  render() {
    // this.address 取值时会收集依赖
    // 当传入的 props 更新时，会触发 renderEffect 重新执行
    return h('div', this.address)
  }
}

const VueComponent = {
  data() {
    return { name: 'Stella', age: 18, flag: false }
  },
  render() {
    return h(Fragment,
      [h('button', { onClick: () => { 
        console.log(this.flag)
        this.flag = !this.flag
        } }, 'toggle render'),
      h(cm1, { address: this.flag ? 'Wuhan' : 'Beijing' })]
    )
  },
  
}

render(h(VueComponent), app)
```


```js
export const PublicInstanceProxyHandlers = {
  get(target, key) {
    const { data, props } = target
    if (data && hasOwn(data, key)) {
      return data[key]
    } else if (hasOwn(props, key)) {
      return props[key]
    }
    // $attrs
    const publicGetter = publicPropertiesMap[key]
    if (publicGetter) {
      return publicGetter(target)
    }
  },
  set(target, key, value) {
    const { data, props } = target
    if (data && hasOwn(data, key)) {
      data[key] = value
      return true
    } else if (hasOwn(props, key)) {
      // prop.key如果是子组件自己修改，则修改不成功，不会触发渲染
      // updateComponent父组件修改数据，render 重新渲染
      // 子组件拿到的新 prop发生变化，手动通过 instance.props.key=newValue
      // 触发子组件重新渲染，取最新 prop 值
      console.warn(`Attempting to mutate prop "${key}". Props are readonly.`)
      return false
    }
    return true
  }
}
```

#### processComponent 主流程
1. mountComponent
2. createComponentInstance
3. createAppContext
4. setupComponent
5. initProps -> reactive component.type.props
6. setupRenderEffect -> ReactiveEffect -> mount vnode -> collect dep
7. componentUpdateFn
8. queueJob -> scheduler -> batchUpdate
9. updateComponent
10. updateProps -> instance.props.key=newVal -> updateComponentFn

![processComponent](./assets/processComponent.png)

#### 优化 updateComponent 

属性更新逻辑抽离出来，slots 更新也会导致页面更新

```js
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
```

```js
function updateProps(prevProps, nextProps) {
  if (hasPropsChanged(prevProps, nextProps)) {
    for (const key in nextProps) {
      // 数据更新，触发
      prevProps[key] = nextProps[key]
    }
    for (const key in prevProps) {
      if (!(key in nextProps)) {
        delete prevProps[key]
      }
    }
  }
}

function updateComponentPreRender(instance, next) {
  instance.next = null
  instance.vnode = next
  updateProps(instance.props, next.props)
}

const componentUpdateFn = () => {
  if (!instance.isMounted) {
    // ...
  } else {
    // updateComponent 属性变化或slots变化，均手动触发 instance.update
    let { next } = instance
    if (next) {
      updateComponentPreRender(instance, next)
    }

    const subTree = render.call(instance.proxy, instance.proxy)
    patch(instance.subTree, subTree, container, anchor)
    instance.subTree = subTree
  }
}
```

#### setup函数
组件的 render 函数每次更新时都会重新执行,但是 setup 函数只会在组件挂载时执行一次。

- setup 函数是 compositionAPI 的入口
- 可以在函数内部编写逻辑，解决 vue2 中反复横跳问题
- setup 返回函数时为组件的 render 函数,返回对象时对象中的数据将暴露给模板使用
- setup 中函数的参数为 props、context({ slots, emit, attrs, expose })

```js
// 组件的render函数每次更新时都会重新执行
// 但是setup函数只会在组件挂载时执行一次。
const VueComponent = {
  props: {
    address: String
  },
  setup(props) {
    const name = ref('Stella')
    return {
      name,
      address: props.address
    }
  },
  render() {
    return h('div', `${this.name}, ${this.address}`)
  },
  
}

render(h(VueComponent, { address: 'Wuhan' }), app)
```

对 setup 函数进行解析
```js
function setupComponent(instance) {
  const { props, type } = instance.vnode
  initProps(instance, props)

  // 解析 setup 
  let { setup } = type
  if (setup) {
    const setupContext = {}
    const setupResult = setup(instance.props, setupContext)

    if (isFunction(setupResult)) {
      instance.render = setupResult
    } else if (isObject(setupResult)) {
      instance.setupState = proxyRefs(setupResult)
    }
  }

  instance.proxy = new Proxy(instance, PublicInstanceProxyHandlers)
  const data = type.data
  if (data) {
    if (!isFunction(data)) return console.warn(`The data option must be a function`)
    instance.data = reactive(data.call(instance.proxy))
  }
  if (!instance.render) {
    instance.render = type.render
  }
}
```

新增取值范围
```js
const PublicInstanceProxyHandlers = {
  get(target, key) {
    const { data, props, setupState } = target
    if (data && hasOwn(data, key)) {
      return data[key]
    } else if (hasOwn(props, key)) {
      return props[key]
    } else if (setupState && hasOwn(setupState, key)) {
      return setupState[key]
    }
    // $attrs
    const publicGetter = publicPropertiesMap[key]
    if (publicGetter) {
      return publicGetter(target)
    }
  },
  set(target, key, value) {
    const { data, props, setupState } = target
    if (data && hasOwn(data, key)) {
      data[key] = value
      return true
    } else if (hasOwn(props, key)) {
      // prop.key如果是子组件自己修改，则修改不成功，不会触发渲染
      // updateComponent父组件修改数据，render 重新渲染
      // 子组件拿到的新 prop发生变化，手动通过 instance.props.key=newValue
      // 触发子组件重新渲染，取最新 prop 值
      console.warn(`Attempting to mutate prop "${key}". Props are readonly.`)
      return false
    } else if (setupState && hasOwn(setupState, key)) {
      setupState[key] = value
    }
    return true
  }
}
```

### 实现emit
```js
const VueComponent = {
  setup(props, ctx) {
    const handleClick = () => ctx.emit('tap')

    return () => h('button', {
      onClick: handleClick
    }, 'Click me')
  },
  
}

render(h(VueComponent, { onTap: () => alert('Bonjour!') }), app)
```

```js
function setupComponent(instance) {
  const { props, type } = instance.vnode
  initProps(instance, props)

  // 解析 setup 
  let { setup } = type
  if (setup) {
    const setupContext = {
      attrs: instance.attrs,
      // 实现 emit
      emit: (event, ...args) => {
        const eventName = `on${event[0].toUpperCase() + event.slice(1)}`
        const handler = instance.vnode.props[eventName]

        handler && handler(...args)
      }
    }
    const setupResult = setup(instance.props, setupContext)

    if (isFunction(setupResult)) {
      instance.render = setupResult
    } else if (isObject(setupResult)) {
      instance.setupState = proxyRefs(setupResult)
    }
  }

  instance.proxy = new Proxy(instance, PublicInstanceProxyHandlers)
  const data = type.data
  if (data) {
    if (!isFunction(data)) return console.warn(`The data option must be a function`)
    instance.data = reactive(data.call(instance.proxy))
  }
  if (!instance.render) {
    instance.render = type.render
  }
}
```

### 实现slot

```js
const Component= {
  render() {
    return h(Fragment, [
      h('div', [this.$slots.header()]),
      h('div', [this.$slots.body()]),
      h('div', [this.$slots.footer()])
    ])
  }
}

const VueComponent = {
  setup() {
    return () =>h(Component, null, {
        header: () => h('p', 'Header'),
        body: () => h('p', 'Body'),
        footer: () => h('p', 'Footer'),
      })
  },
  
}

render(h(VueComponent), app)
```

```js
export const createVNode = (type, props, children = null) => {

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
```

```js
export const publicPropertiesMap = {
  $attrs: i => i.attrs,
  $slots: i => i.slots
}
```

```js
function initSlots(instance, children) {
  if (instance.vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    instance.slots = children
  }
}
```

```js
export function setupComponent(instance) {
  const { props, type, children } = instance.vnode
  initProps(instance, props)
  initSlots(instance, children)
}
```

### 生命周期实现原理
生命周期需要让当前实例关联对应的生命周期，这样在组件构建过程中就可以调用对应的钩子

component.ts
```js
export const setCurrentInstance = instance => (currentInstance = instance)
export const getCurrentInstance = () => currentInstance
export const unsetCurrentInstance = (val = null) => currentInstance = null
```

```js
setCurrentInstance(instance)
const setupResult = setup(instance.props, setupContext)
unsetCurrentInstance(null)
```

#### 创建生命周期钩子
apiLifecycle.ts
```js
import { currentInstance, setCurrentInstance } from "./component";

export const enum LifecycleHooks {
  BEFORE_MOUNT = 'bm',
  MOUNTED = 'm',
  BEFORE_UPDATE = 'bu',
  UPDATED = 'u'
}

function createHook(type) {
  return (hook, target = currentInstance) => {
    if (target) {
      const hooks = target[type] || (target[type] = [])
      const wrappedHook = () => {
        setCurrentInstance(target)
        hook.call(target)
        setCurrentInstance(null)
      }
      hooks.push(wrappedHook)
    }
  }
}

export const onBeforeMount = createHook(LifecycleHooks.BEFORE_MOUNT)
export const onMounted = createHook(LifecycleHooks.MOUNTED)
export const onBeforeUpdate = createHook(LifecycleHooks.BEFORE_UPDATE)
export const updated = createHook(LifecycleHooks.UPDATED)
```

#### 钩子调用

```js
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
```

## 补充

### 位运算符 
[reference](https://www.runoob.com/w3cnote/bit-operation.html)
| 符号 | 描述 | 运算规则 |
| ---- | ---- | --- |
| &	| 与 |	两个位都为1时，结果才为1 |
| \|| 或 |	两个位都为0时，结果才为0 |
| ^	| 异或 |	两个位相同为0，相异为1 |
| ~	| 取反 |	0变1，1变0 |
| <<| 左移 |	各二进位全部左移若干位，高位丢弃，低位补0 |
| >>| 右移 |	各二进位全部右移若干位，对无符号数，高位补0，有符号数，各编译器处理方法不一样，有的补符号位（算术右移），有的补0（逻辑右移） |
## Error Records

1. `dev` 环境下的打包，基于 `esbuild` 快捷高效，便于 `tree-shaking`。打包时，dev.js 文件，引入包名时有两种方式`import or require`。如果使用 `node require` 方式，打包编译时会报如下错误：
 ![typeError](./assets/typeError.jpg)
解决：根据提示可知，package.json 中添加 `type: "module"` 即可。

2. 上述步骤，再次运行，新问题出现：
 ![nodeBuildReferenceError](./assets/nodeBuildReferenceError.jpg)
解决： `__dirname` 属于 `node` 变量，在 `module` 中存在。根据源码，可引用 `dirname` 方法。
 ![dirname](./assets/dirname.jpg)

