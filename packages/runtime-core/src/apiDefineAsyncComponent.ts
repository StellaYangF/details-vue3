import { ref } from "@vue/reactivity"
import { Fragment, h } from "./vnode"
import { isFunction } from "@vue/shared"

export function defineAsyncComponent(options) {
  if (isFunction(options)) {
    options.loader = options
  }
  let defaultComp = h(Fragment, [])

  return {
    setup() {
      const {
        loader,
        timeout,
        delay,
        loadingComponent = defaultComp,
        errorComponent = defaultComp,
        onError
      } = options
      const loading = ref(false)
      const loaded = ref(false)
      const error = ref(false)
      let component
      let attempts = 1

      if (delay) {
        setTimeout(() => loading.value = true, delay)
      }

      if (timeout) {
        setTimeout(() => {
          onLoadError('timeout')
        }, timeout)
      }

      const onLoadError = err => {
        error.value = true
        new Promise((resolve, reject) => {
          if (onError && !loaded.value) {
            const retry = () => resolve(load())
            const fail = () => reject()
            onError(err, retry, fail, attempts++)
          }
        })
      }

      // 这里不用 async await 写法，vue 内部会加入 suspense流程
      function load() {
        loader().then(comp => {
          component = comp
          loaded.value = true
        }).catch(onLoadError)
      }
      load()

      return () => {
        if (loaded.value) {
          return h(component)
        } else if (error.value) {
          return errorComponent
        } else if (loading.value) {
          return loadingComponent
        }
        return defaultComp
      }
    }
  }
}