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
cconst school = {
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

