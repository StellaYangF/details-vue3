import { isObject } from "@vue/shared"
import { track, trigger } from "./effect"
import { ReactiveFlags, reactive } from "./reactive"

export const mutableHandlers = {
  get(target, key, receiver) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return true
    }

    const res = Reflect.get(target, key, receiver)
    if (isObject(res)) {
      return reactive(res)
    }

    // 取值关联 target, key 和 effect
    track(target, 'get', key)

    return res
  },

  set(target, key, value, receiver) {

    // 更新执行 key 关联 effect
    const oldValue = target[key]
    const result = Reflect.set(target, key, value, receiver)

    if (oldValue !== value) {
      trigger(target, 'set', key, value, oldValue)
    }

    return result
  },
}