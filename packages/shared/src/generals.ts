export function isObject(val) {
  return val !== null && typeof val === 'object'
}

export function isFunction(val) {
  return typeof val === 'function'
}

export function isArray(val) {
  return Array.isArray(val)
}

const onRE = /^on[^a-z]/
export const isOn = (key: string) => onRE.test(key)