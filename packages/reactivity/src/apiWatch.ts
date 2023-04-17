// watchEffect = effect...
// watch = effect + 包装

import { isFunction, isObject } from "@vue/shared";
import { isReactive } from "./reactive";
import { ReactiveEffect } from "./effect";

// watch 可以监听一个响应式对象

// 模拟 effect + scheduler 取值操作，收集依赖，并将前后取值返回
export function watch(source, cb) {
  // 1. source 是响应式对象
  // 2. source 是一个函数
  // 3. ReactiveEffect fn 为取值操作，() => 自动触发操作

  let getter;
  if (isReactive(source)) {
    getter = traverse(source)
  } else if (isFunction(source)) {
    getter = source
  }

  let oldValue

  const scheduler = () => {
    const newValue = effect.run()
    cb(newValue, oldValue)
    oldValue = newValue
  }

  const effect = new ReactiveEffect(getter, scheduler)

  // 先触发取值，收集依赖，保存 getter 返回的值
  oldValue = effect.run()
}

function traverse(value, seen = new Set()) {
  /**
   * 遍历对象，触发取值操作
   * 1. 非对象，直接返回
   * 2. 对象引用自己，直接返回(如：window.window)，防止循环引用
   * 3. 迭代取值，存放在 seen 中
   */
  if (!isObject) {
    return value
  }

  if (seen.has(value)) {
    return value
  }

  seen.add(value)
  for (let key in value) {
    traverse(value[key], seen)
  }

  return value
}