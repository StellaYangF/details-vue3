import { reactive } from "@vue/reactivity"
import { hasOwn } from "@vue/shared"

export const publicPropertiesMap = {
  $attrs: i => i.attrs
}

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