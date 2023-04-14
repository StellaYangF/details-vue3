// packages/shared/src/index.ts
function isObject(val) {
  return val !== null && typeof val === "object";
}

// packages/reactivity/src/effect.ts
var activeEffect = null;
var ReactiveEffect = class {
  constructor(fn) {
    this.fn = fn;
  }
  run() {
    try {
      activeEffect = this;
      this.fn();
    } finally {
      activeEffect = null;
    }
  }
  stop() {
  }
};
function effect(fn) {
  const _effect = new ReactiveEffect(fn);
  _effect.run();
}

// packages/reactivity/src/baseHandlers.ts
var mutableHandlers = {
  get(target, key, receiver) {
    if (key === "__v_isReactive" /* IS_REACTIVE */) {
      return true;
    }
    console.log(activeEffect);
    return Reflect.get(target, key, receiver);
  },
  set(target, key, value, receiver) {
    return Reflect.set(target, key, value, receiver);
  }
};

// packages/reactivity/src/reactive.ts
var ReactiveFlags = /* @__PURE__ */ ((ReactiveFlags2) => {
  ReactiveFlags2["IS_REACTIVE"] = "__v_isReactive";
  return ReactiveFlags2;
})(ReactiveFlags || {});
var reactiveMap = /* @__PURE__ */ new WeakMap();
function reactive(target) {
  if (!isObject(target))
    return target;
  let existingProxy = reactiveMap.get(target);
  if (existingProxy) {
    return existingProxy;
  }
  if (target["__v_isReactive" /* IS_REACTIVE */]) {
    return target;
  }
  const proxy = new Proxy(target, mutableHandlers);
  reactiveMap.set(target, proxy);
  return proxy;
}
export {
  ReactiveFlags,
  activeEffect,
  effect,
  reactive
};
//# sourceMappingURL=index.js.map
