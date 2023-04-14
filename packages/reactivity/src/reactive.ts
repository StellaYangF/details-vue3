import { isObject } from "@vue/shared";
import { mutableHandlers } from "./baseHandlers";

export const enum ReactiveFlags {
  IS_REACTIVE = '__v_isReactive'
}
const reactiveMap = new WeakMap()

export function reactive<T extends object>(target: T)
export function reactive(target: object) {
  // target 值不同，处理方式如下：
  // 1. 非对象不代理
  if (!isObject(target)) return target

  // 2. 重复代理
  let existingProxy = reactiveMap.get(target)
  if (existingProxy) {
    return existingProxy
  }

  // 3. 代理后对象
  if (target[ReactiveFlags.IS_REACTIVE]) {
    return

  }
  const proxy = new Proxy(target, mutableHandlers)


















































  reactiveMap.set(target, proxy)
  return proxy
}

function createReactiveObject() {

}