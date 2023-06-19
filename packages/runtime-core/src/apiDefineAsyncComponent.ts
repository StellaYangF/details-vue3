import { ref } from "@vue/reactivity"
import { Fragment, h } from "./vnode"
import { isFunction, isObject } from "@vue/shared"

// 异步组件
// 1. 先渲染一个空，再渲染组件的

export function defineAsyncComponent(options) {
  if (isFunction(options)) {
    options.loader = options
  }

  return {
    setup() {
      const { loader } = options
      const flag = ref(false)
      let component

      // 这里不用 async await 写法，vue 内部会加入 suspense流程
      loader().then(comp => {
        component = comp
        flag.value = true
      })
      return () => flag.value
        ? h(component)
        : h(Fragment, [])
    }
  }
}
