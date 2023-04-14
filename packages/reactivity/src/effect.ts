export let activeEffect = null

class ReactiveEffect {
  constructor(private fn) { }

  run() {
    try {
      activeEffect = this
      this.fn()
    } finally {
      activeEffect = null
    }
  }

  stop() { }
}


export function effect(fn) {
  const _effect = new ReactiveEffect(fn)
  _effect.run()
}