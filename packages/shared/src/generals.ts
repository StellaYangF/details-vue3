export function isObject(val) {
  return val !== null && typeof val === 'object'
}

export function isFunction(val) {
  return typeof val === 'function'
}

export const isArray = Array.isArray

const onRE = /^on[^a-z]/
export const isOn = (key: string) => onRE.test(key)

export const isString = (val: unknown): val is string => typeof val === 'string'