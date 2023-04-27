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

export const EMPTY_OBJ: { readonly [key: string]: any } = {}

export const NO = () => false


const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (
  val: object,
  key: string | symbol
): key is keyof typeof val => hasOwnProperty.call(val, key)

export const invokeArrayFns = fns => {
  for (let i = 0; i < fns.length; i++) {
    fns[i]()
  }
}