import { EMPTY_OBJ, isFunction } from "@vue/shared"
import { createAppContext } from "./apiCreateApp"
import { PublicInstanceProxyHandlers, initProps } from "./componentProps"
import { reactive } from "@vue/reactivity"

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
    root: null!, // 立即设置
    isMounted: false,
    subTree: null!, // 要渲染的子节点
    update: null!, // creation 后同步设置
    // state
    data: EMPTY_OBJ,
    ctx: EMPTY_OBJ,
    props: EMPTY_OBJ, // 父组件传入的 props
    attrs: EMPTY_OBJ, // 子组件没有定义 props,会放入 $attrs中
    slots: EMPTY_OBJ,
    refs: EMPTY_OBJ,
    setupState: EMPTY_OBJ,
    setupContext: null,
    proxy: null, // 代理对象
    propsOptions: vnode.props
  }

  return instance
}

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