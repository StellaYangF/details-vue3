import { activeEffect, track, trigger } from "./effect"
import { ReactiveFlags } from "./reactive"

export const mutableHandlers = {
  get(target, key, receiver) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return true
    }

    // 取值关联 target, key 和 effect
    track(target, 'get', key)

    return Reflect.get(target, key, receiver)
  },
  set(target, key, value, receiver) {
    const result = Reflect.set(target, key, value, receiver)

    // 更新执行 key 关联 effect
    const oldValue = target[key]
    if (oldValue !== value) {
      trigger(target, 'set', key, value, oldValue)
    }
    return result
  },
}