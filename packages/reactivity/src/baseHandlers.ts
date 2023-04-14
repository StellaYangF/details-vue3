import { activeEffect } from "./effect"
import { ReactiveFlags } from "./reactive"

export const mutableHandlers = {
  get(target, key, receiver) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return true
    }
    console.log(activeEffect)
    // 取值关联 key 和 effect
    return Reflect.get(target, key, receiver)
  },
  set(target, key, value, receiver) {
    // 更新执行 key 关联 effect
    return Reflect.set(target, key, value, receiver)
  },
}