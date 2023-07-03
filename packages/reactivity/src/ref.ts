import { isArray, isObject } from "@vue/shared"
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

class ObjectRefImpl {
  public __v_isRef = true

  constructor(public _object, public _key) { }

  get value() {
    return this._object[this._key]
  }

  set value(newVal) {
    this._object[this._key] = newVal
  }
}

export function toRef(object, key) {
  return new ObjectRefImpl(object, key)
}

export function toRefs(object) {
  const ref = isArray(object)
    ? new Array(object.length)
    : {}

  for (const key in object) {
    ref[key] = toRef(object, key)
  }

  return ref
}

export function proxyRefs(objectWithRefs) {
  return new Proxy(objectWithRefs, {
    get(target, key, receiver) {
      const v = Reflect.get(target, key, receiver)

      return v.__v_isRef ? v.value : v
    },

    // 设置的时候如果是ref,则给ref.value赋值
    set(target, key, value, receiver) {
      const oldValue = target[key]
      if (oldValue.__v_isRef) {
        oldValue.value = value
        return value
      } else {
        return Reflect.set(target, key, value, receiver)
      }
    }
  })
}