import { isFunction } from "@vue/shared";
import { ReactiveEffect, activeEffect, trackEffects, triggerEffects } from "./effect";

class ComputedRefImpl {
  public _dirty = true
  public _value
  public dep
  public effect
  constructor(getter, public setter) {
    this.effect = new ReactiveEffect(getter, () => {
      this._dirty = true

      // 数据更新时，触发effect执行
      triggerEffects(this.dep)
    })
  }

  get value() {
    // 取值收集依赖：在 effect 中使用时，单独做依赖收集
    if (activeEffect) {
      trackEffects(this.dep || (this.dep = new Set()))
    }

    // 懒执行-数据不变缓存
    if (this._dirty) {
      this._value = this.effect.run()
      this._dirty = false
    }
    return this._value
  }

  set value(newVal) {
    this.setter(newVal)
  }
}

export function computed(getterOptions) {
  let getter
  let setter
  if (isFunction(getterOptions)) {
    getter = getterOptions
  } else {
    getter = getterOptions.get
    setter = getterOptions.set
  }

  return new ComputedRefImpl(getter, setter)
}