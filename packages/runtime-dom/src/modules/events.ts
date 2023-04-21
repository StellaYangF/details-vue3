
/* patch event */
function createInvoker(initialValue) {
  // 动态换绑事件回调
  // el.addEventListener(name, nextValue) 
  // nextValue 直接传入，后续更改了回调，需要解绑再绑
  // el.addEventListener(name, invoker.value)
  const invoker = e => invoker.value(e)
  invoker.value = initialValue

  return invoker
}

interface Invoker extends EventListener {
  value: EventValue
}

type EventValue = Function | Function[]

export function patchEvent(
  el: Element & { _vei?: Record<string, Invoker | undefined> },
  rawName: string,
  nextValue: EventValue | null
) {
  const invokers = el._vei || (el._vei = {})

  // cache
  const exsistingInvoker = invokers[rawName]

  if (nextValue && exsistingInvoker) {
    exsistingInvoker.value = nextValue
  } else {
    const name = rawName.slice(2).toLocaleLowerCase()

    if (nextValue) {
      // bind new event and cache
      const invoker = (invokers[rawName] = createInvoker(nextValue))
      el.addEventListener(name, invoker)
    } else if (exsistingInvoker) {
      // remove
      el.removeEventListener(name, exsistingInvoker)
      invokers[rawName] = undefined
    }
  }
}