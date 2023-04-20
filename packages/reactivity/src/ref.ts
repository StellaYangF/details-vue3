import { isObject } from "@vue/shared"
import { reactive } from "./reactive"
import { activeEffect, trackEffects, triggerEffects } from "./effect"

// proxy 代理的目标必须是非原始值，所以 reactive 不支持原始值类型
// Ref 将原始值类型进行包装
class RefImpl {
  public _value
  public dep
  public __v_isRef = true
  constructor(public rawValue, public _shallow: boolean) {
    this._value = _shallow ? rawValue : toReactive(rawValue)
  }

  get value() {
    if (activeEffect) {
      trackEffects(this.dep || (this.dep = new Set()))
    }
    return this._value
  }

  set value(newVal) {
    if (newVal !== this.rawValue) {
      this._value = newVal
      this.rawValue = this._shallow ? newVal : toReactive(newVal)
      triggerEffects(this.dep)
    }
  }
}

function toReactive(value) {
  return isObject(value) ? reactive(value) : value
}

function createRef(rawValue, shallow: boolean) {
  return new RefImpl(rawValue, shallow)
}

export function ref(value) {
  return createRef(value, false)
}

// 只会代理一层，rawValue 如果是对象，不会深层代理
export function shallowRef(value) {
  return createRef(value, true)
}
