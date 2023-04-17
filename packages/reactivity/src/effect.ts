export let activeEffect = null

// 记录依赖关系 {target -> key -> dep}
const targetMap = new WeakMap()
export class ReactiveEffect {
  private parent
  active = true
  // 记录 effect 中使用的属性
  deps = []
  constructor(private fn, public scheduler) { }

  run() {
    try {
      // 手动stop后，用户调用runner时，只会重新执行
      // 不会收集依赖
      if (!this.active) {
        return this.fn()
      }
      this.parent = activeEffect
      activeEffect = this
      // 清理收集的 effect
      cleanupEffect(this)
      return this.fn()
    } finally {
      activeEffect = this.parent
      this.parent = undefined
    }
  }

  stop() {
    if (this.active) {
      // 失活，手动runner时，不走依赖收集
      this.active = false
      // 清除依赖
      cleanupEffect(this)
    }
  }
}


export function effect(fn, options: any = {}) {
  const _effect = new ReactiveEffect(fn, options.scheduler)


  _effect.run()
  /**
   * 返回 run 方法，并将 effect 实例暴露出去
   */
  const runner = _effect.run.bind(_effect)
  runner.effect = _effect
  return runner
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
      // name & address 对应的 dep 是两个不同的 set
      // name => [dep]   address => [dep]
      activeEffect.deps.push(dep)
    }
  }
}

export function trigger(target, type, key, value, oldValue) {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    return
  }

  const deps = depsMap.get(key) || new Set()
  /**
   * 直接操作 effects 会导致死循环
   * 解决：应改为副本，再迭代操作
   * 
   * { name: Set[e1, e2] }
   * { age: Set[e2, e3] }
   */

  const effects = [...deps]
  effects && effects.forEach(effect => {
    // 防止再次执行的 effect
    if (effect !== activeEffect) {
      if (effect.scheduler) {
        effect.scheduler()
      } else {
        effect.run()
      }
    }
  });

}

function cleanupEffect(effect) {
  const { deps } = effect

  for (let i = 0; i < deps.length; i++) {
    deps[i].delete(effect)
  }
  effect.deps.length = 0
}