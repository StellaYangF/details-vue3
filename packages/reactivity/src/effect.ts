export let activeEffect = null

// 记录依赖关系 {target -> key -> dep}
const targetMap = new WeakMap()
export class ReactiveEffect {
  private parent
  public active = true
  // 记录 effect 中使用的属性
  public deps = []
  constructor(private fn, public scheduler?) {
    if (activeEffectScope && activeEffectScope.active) {
      activeEffectScope.effects.push(this)
    }
  }

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

    trackEffects(dep)
  }
}

export function trackEffects(dep) {
  let shouldTrack = !dep.has(activeEffect)
  if (shouldTrack) {
    dep.add(activeEffect)
    // name & address 对应的 dep 是两个不同的 set
    // name => [dep]   address => [dep]
    activeEffect.deps.push(dep)
  }
}

export function trigger(target, type, key, value, oldValue) {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    return
  }

  const dep = depsMap.get(key) || new Set()
  /**
   * 直接操作 effects 会导致死循环
   * 解决：应改为副本，再迭代操作
   * 
   * { name: Set[e1, e2] }
   * { age: Set[e2, e3] }
   */

  const effects = [...dep]
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

export function triggerEffects(dep) {
  const effects = [...dep]
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

// effectScope 是用于提供作用域的，函数调用后返回的对象包含 run 和 stop 方法
// run 方法，接收需要订阅观察的 effect,
// stop 方法，则是触发发布所订阅的 effect.stop，停止响应数据的依赖收集
// 内部逻辑还是发布订阅的模式，
// 在此作用域下
let activeEffectScope
class EffectScope {
  public active = true
  public effects = []
  public scopes = []
  public parent

  run(fn) {
    if (this.active) {
      try {
        this.parent = activeEffectScope
        activeEffectScope = this
        return fn()
      } finally {
        activeEffectScope = this.parent
        this.parent = null
      }
    }
  }

  stop() {
    if (this.active) {
      this.active = false
      this.effects.forEach(effect => effect.stop())
      this.scopes.forEach(scope => scope.stop())
    }
  }
}

export function effectScope(detached = false): EffectScope {
  const scope = new EffectScope()
  if (!detached && activeEffectScope) {
    activeEffectScope.scopes.push(scope)
  }
  console.log(activeEffectScope)
  return scope
}