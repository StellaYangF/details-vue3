
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
