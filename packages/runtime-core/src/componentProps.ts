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

export const hasPropsChanged = (prevProps = {}, nextProps = {}) => {
  const nextKeys = Object.keys(nextProps)

  for (let i = 0; i < nextKeys.length; i++) {
    const key = nextKeys[i]
    if (nextProps[key] !== prevProps[key]) {
      return true
    }
  }

  return false
}

export function updateProps(instance, prevProps, nextProps) {
  if (hasPropsChanged(prevProps, nextProps)) {
    for (const key in nextProps) {
      // 数据更新，触发
      instance.props[key] = nextProps[key]
    }
    for (const key in instance.props) {
      if (!(key in nextProps)) {
        delete instance.props[key]
      }
    }
  }
}
