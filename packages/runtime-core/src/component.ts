import { EMPTY_OBJ, isFunction, isObject } from "@vue/shared"
import { createAppContext } from "./apiCreateApp"
import { PublicInstanceProxyHandlers, initProps } from "./componentProps"
import { proxyRefs, reactive } from "@vue/reactivity"

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

export function setupComponent(instance) {
  const { props, type } = instance.vnode
  initProps(instance, props)

  // 解析 setup 
  let { setup } = type
  if (setup) {
    const setupContext = {
      attrs: instance.attrs,
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