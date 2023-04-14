export let activeEffect = null

class ReactiveEffect {
  private parent
  constructor(private fn) { }

  run() {
    try {
      this.parent = activeEffect
      activeEffect = this
      this.fn()
    } finally {
      activeEffect = this.parent
    }
  }

  stop() { }
}


export function effect(fn) {
  const _effect = new ReactiveEffect(fn)
  _effect.run()
}