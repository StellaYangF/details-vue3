import { isOn } from "@vue/shared"
import { patchEvent } from "./modules/events"
import { patchStyle } from "./modules/style"
import { patchClass } from "./modules/class"
import { patchAttr } from "./modules/attrs"

export function patchProp(el, key, prevValue, nextValue) {
  if (key === 'class') {
    patchClass(el, nextValue)
  } else if (key === 'style') {
    patchStyle(el, prevValue, nextValue)
  } else if (isOn(key)) {
    patchEvent(el, key, nextValue)
  } else {
    patchAttr(el, key, nextValue)
  }
}

