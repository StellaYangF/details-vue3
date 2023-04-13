import { isObject } from "@vue/shared";

export function reactive(value: object) {
  if (!isObject(value)) return value

  const proxy = new Proxy(value, {
    get(target, key, receive) {
      console.log('get collect', key)
      return Reflect.get(target, key, receive)
    },
    set(target, key, value, receive) {
      console.log('set', key, value)
      return Reflect.set(target, key, value, receive)
    }
  })

  return proxy
}