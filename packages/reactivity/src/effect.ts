export let activeEffect = null

// 记录依赖关系 {target -> key -> dep}
const targetMap = new WeakMap()
class ReactiveEffect {
  private parent
  active = true
  // 记录 effect 中使用的属性
  deps = []
  constructor(private fn) { }

  run() {
    try {
      this.parent = activeEffect
      activeEffect = this
      this.fn()
    } finally {
      activeEffect = this.parent
      this.parent = undefined
    }
  }

  stop() { }
}


export function effect(fn) {
  const _effect = new ReactiveEffect(fn)
  _effect.run()
}

export function track(target, type, key) {
  // effect 函数内取值才会收集依赖
  // connection: WeakMap: {target: Map{key: Set[]}}
  if (activeEffect) {
    let depsMap = targetMap.get(target)
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()))
    }

    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, (dep = new Set()))
    }

    let shouldTrack = !dep.has(activeEffect)
    if (shouldTrack) {
      dep.add(activeEffect)
      activeEffect.deps.push(dep)
    }
  }
}

export function trigger() { }