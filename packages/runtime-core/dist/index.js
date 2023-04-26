// packages/shared/src/generals.ts
function isObject(val) {
  return val !== null && typeof val === "object";
}
function isFunction(val) {
  return typeof val === "function";
}
var isArray = Array.isArray;
var onRE = /^on[^a-z]/;
var isOn = (key) => onRE.test(key);
var isString = (val) => typeof val === "string";
var EMPTY_OBJ = {};
var NO = () => false;
var hasOwnProperty = Object.prototype.hasOwnProperty;
var hasOwn = (val, key) => hasOwnProperty.call(val, key);

// packages/runtime-dom/src/nodeOps.ts
var doc = typeof document !== "undefined" ? document : null;
var nodeOps = {
  insert: (child, parent, anchor) => {
    parent.insertBefore(child, anchor || null);
  },
  remove: (child) => {
    const parent = child.parentNode;
    if (parent) {
      parent.removeChild(child);
    }
  },
  createElement: (tag) => doc.createElement(tag),
  createText: (text) => doc.createTextNode(text),
  createComment: (text) => doc.createComment(text),
  setText: (node, text) => {
    node.nodeValue = text;
  },
  setElementText: (el, text) => {
    el.textContent = text;
  },
  parentNode: (node) => node.parentNode,
  nextSibling: (node) => node.nextSibling,
  querySelector: (selector) => doc.querySelector(selector)
};

// packages/runtime-dom/src/modules/events.ts
function createInvoker(initialValue) {
  const invoker = (e) => invoker.value(e);
  invoker.value = initialValue;
  return invoker;
}
function patchEvent(el, rawName, nextValue) {
  const invokers = el._vei || (el._vei = {});
  const exsistingInvoker = invokers[rawName];
  if (nextValue && exsistingInvoker) {
    exsistingInvoker.value = nextValue;
  } else {
    const name = rawName.slice(2).toLocaleLowerCase();
    if (nextValue) {
      const invoker = invokers[rawName] = createInvoker(nextValue);
      el.addEventListener(name, invoker);
    } else if (exsistingInvoker) {
      el.removeEventListener(name, exsistingInvoker);
      invokers[rawName] = void 0;
    }
  }
}

// packages/runtime-dom/src/modules/style.ts
function patchStyle(el, prev, next) {
  const style = el.style;
  for (const key in next) {
    style[key] = next[key];
  }
  for (const key in prev) {
    if (next == null || next[key] == null) {
      style[key] = null;
    }
  }
}

// packages/runtime-dom/src/modules/class.ts
function patchClass(el, value) {
  if (value == null) {
    el.removeAttribute("class");
  } else {
    el.className = value;
  }
}

// packages/runtime-dom/src/modules/attrs.ts
function patchAttr(el, key, value) {
  if (value == null) {
    el.removeAttribute(key);
  } else {
    el.setAttribute(key, value);
  }
}

// packages/runtime-dom/src/patchProp.ts
function patchProp(el, key, prevValue, nextValue) {
  if (key === "class") {
    patchClass(el, nextValue);
  } else if (key === "style") {
    patchStyle(el, prevValue, nextValue);
  } else if (isOn(key)) {
    patchEvent(el, key, nextValue);
  } else {
    patchAttr(el, key, nextValue);
  }
}

// packages/runtime-dom/src/index.ts
var renderOptions = Object.assign({ patchProp }, nodeOps);

// packages/runtime-core/src/vnode.ts
var Text = Symbol.for("v-text");
var Fragment = Symbol.for("v-fgt");

// packages/runtime-core/src/apiCreateApp.ts
function createAppContext() {
  return {
    app: null,
    config: {
      isNativeTag: NO,
      performance: false,
      globalProperties: {},
      optionMergeStrategies: {},
      errorHandler: void 0,
      warnHandler: void 0,
      compilerOptions: {}
    },
    mixins: [],
    components: {},
    directives: {},
    provides: /* @__PURE__ */ Object.create(null),
    optionsCache: /* @__PURE__ */ new WeakMap(),
    propsCache: /* @__PURE__ */ new WeakMap(),
    emitsCache: /* @__PURE__ */ new WeakMap()
  };
}

// packages/reactivity/src/effect.ts
var activeEffect = null;
var targetMap = /* @__PURE__ */ new WeakMap();
var ReactiveEffect = class {
  constructor(fn, scheduler) {
    this.fn = fn;
    this.scheduler = scheduler;
    this.active = true;
    // 记录 effect 中使用的属性
    this.deps = [];
  }
  run() {
    try {
      if (!this.active) {
        return this.fn();
      }
      this.parent = activeEffect;
      activeEffect = this;
      cleanupEffect(this);
      return this.fn();
    } finally {
      activeEffect = this.parent;
      this.parent = void 0;
    }
  }
  stop() {
    if (this.active) {
      this.active = false;
      cleanupEffect(this);
    }
  }
};
function track(target, type, key) {
  if (activeEffect) {
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      targetMap.set(target, depsMap = /* @__PURE__ */ new Map());
    }
    let dep = depsMap.get(key);
    if (!dep) {
      depsMap.set(key, dep = /* @__PURE__ */ new Set());
    }
    trackEffects(dep);
  }
}
function trackEffects(dep) {
  let shouldTrack = !dep.has(activeEffect);
  if (shouldTrack) {
    dep.add(activeEffect);
    activeEffect.deps.push(dep);
  }
}
function trigger(target, type, key, value, oldValue) {
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    return;
  }
  const dep = depsMap.get(key) || /* @__PURE__ */ new Set();
  const effects = [...dep];
  effects && effects.forEach((effect) => {
    if (effect !== activeEffect) {
      if (effect.scheduler) {
        effect.scheduler();
      } else {
        effect.run();
      }
    }
  });
}
function cleanupEffect(effect) {
  const { deps } = effect;
  for (let i = 0; i < deps.length; i++) {
    deps[i].delete(effect);
  }
  effect.deps.length = 0;
}

// packages/reactivity/src/baseHandlers.ts
var mutableHandlers = {
  get(target, key, receiver) {
    if (key === "__v_isReactive" /* IS_REACTIVE */) {
      return true;
    }
    const res = Reflect.get(target, key, receiver);
    if (isObject(res)) {
      return reactive(res);
    }
    track(target, "get", key);
    return res;
  },
  set(target, key, value, receiver) {
    const oldValue = target[key];
    const result = Reflect.set(target, key, value, receiver);
    if (oldValue !== value) {
      trigger(target, "set", key, value, oldValue);
    }
    return result;
  }
};

// packages/reactivity/src/reactive.ts
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

// packages/runtime-core/src/componentProps.ts
var publicPropertiesMap = {
  $attrs: (i) => i.attrs
};
function initProps(instance, rawProps) {
  const props = {};
  const attrs = {};
  const options = instance.propsOptions || {};
  if (rawProps) {
    for (let key in rawProps) {
      const value = rawProps[key];
      if (key in options) {
        props[key] = value;
      } else {
        attrs[key] = value;
      }
    }
  }
  instance.props = reactive(props);
  instance.attrs = attrs;
}
var PublicInstanceProxyHandlers = {
  get(target, key) {
    const { data, props } = target;
    if (data && hasOwn(data, key)) {
      return data[key];
    } else if (hasOwn(props, key)) {
      return props[key];
    }
    const publicGetter = publicPropertiesMap[key];
    if (publicGetter) {
      return publicGetter(target);
    }
  },
  set(target, key, value) {
    const { data, props } = target;
    if (data && hasOwn(data, key)) {
      data[key] = value;
      return true;
    } else if (hasOwn(props, key)) {
      console.warn(`Attempting to mutate prop "${key}". Props are readonly.`);
      return false;
    }
    return true;
  }
};
var hasPropsChanged = (prevProps = {}, nextProps = {}) => {
  const nextKeys = Object.keys(nextProps);
  for (let i = 0; i < nextKeys.length; i++) {
    const key = nextKeys[i];
    if (nextProps[key] !== prevProps[key]) {
      return true;
    }
  }
  return false;
};
function updateProps(instance, prevProps, nextProps) {
  if (hasPropsChanged(prevProps, nextProps)) {
    for (const key in nextProps) {
      instance.props[key] = nextProps[key];
    }
    for (const key in instance.props) {
      if (!(key in nextProps)) {
        delete instance.props[key];
      }
    }
  }
}

// packages/runtime-core/src/component.ts
var emptyAppContext = createAppContext();
var uid = 0;
function createComponentInstance(vnode) {
  const type = vnode.type;
  const appContext = emptyAppContext;
  const instance = {
    uid: uid++,
    vnode,
    // 组件的虚拟节点
    type,
    appContext,
    isMounted: false,
    subTree: null,
    // 要渲染的子节点
    update: null,
    // creation 后同步设置
    // state
    data: EMPTY_OBJ,
    props: EMPTY_OBJ,
    // 父组件传入的 props
    attrs: EMPTY_OBJ,
    // 子组件没有定义 props,会放入 $attrs中
    proxy: null,
    // 代理对象
    propsOptions: vnode.type.props
    // VueComponent.type 为一个对象
  };
  return instance;
}
function setupComponent(instance) {
  const { props, type } = instance.vnode;
  initProps(instance, props);
  instance.proxy = new Proxy(instance, PublicInstanceProxyHandlers);
  const data = type.data;
  if (data) {
    if (!isFunction(data))
      return console.warn(`The data option must be a function`);
    instance.data = reactive(data.call(instance.proxy));
  }
  instance.render = type.render;
}

// packages/runtime-core/src/scheduler.ts
var queue = [];
var isFlushing = false;
var resolvedPromise = Promise.resolve();
function queueJob(job) {
  if (!queue.includes(job)) {
    queue.push(job);
  }
  if (!isFlushing) {
    isFlushing = true;
    resolvedPromise.then(() => {
      isFlushing = false;
      const copy = queue.slice();
      queue.length = 0;
      copy.forEach(job);
      copy.length = 0;
    });
  }
}

// packages/runtime-core/src/renderer.ts
var ShapeFlags = /* @__PURE__ */ ((ShapeFlags2) => {
  ShapeFlags2[ShapeFlags2["ELEMENT"] = 1] = "ELEMENT";
  ShapeFlags2[ShapeFlags2["FUNCTION_COMPONENT"] = 2] = "FUNCTION_COMPONENT";
  ShapeFlags2[ShapeFlags2["STATEFUL_COMPONENT"] = 4] = "STATEFUL_COMPONENT";
  ShapeFlags2[ShapeFlags2["TEXT_CHILDREN"] = 8] = "TEXT_CHILDREN";
  ShapeFlags2[ShapeFlags2["ARRAY_CHILDREN"] = 16] = "ARRAY_CHILDREN";
  ShapeFlags2[ShapeFlags2["SLOTS_CHILDREN"] = 32] = "SLOTS_CHILDREN";
  ShapeFlags2[ShapeFlags2["TELEPORT"] = 64] = "TELEPORT";
  ShapeFlags2[ShapeFlags2["SUSPENSE"] = 128] = "SUSPENSE";
  ShapeFlags2[ShapeFlags2["COMPONENT_SHOULD_KEEP_ALIVE"] = 256] = "COMPONENT_SHOULD_KEEP_ALIVE";
  ShapeFlags2[ShapeFlags2["COMPONENT_KEPT_ALIVE"] = 512] = "COMPONENT_KEPT_ALIVE";
  ShapeFlags2[ShapeFlags2["COMPONENT"] = 6] = "COMPONENT";
  return ShapeFlags2;
})(ShapeFlags || {});
var isSameVNodeType = (n1, n2) => {
  return n1.type === n2.type && n1.key === n2.key;
};
function createRenderer(options) {
  const {
    insert: hostInsert,
    remove: hostRemove,
    createElement: hostCreateElement,
    createText: hostCreateText,
    createComment: hostCreateComment,
    setText: hostSetText,
    setElementText: hostSetElementText,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling,
    querySelector: hostQuerySelector,
    patchProp: hostPatchProp
  } = options;
  const mountElement = (vnode, container, anchor) => {
    const { type, props, shapeFlag } = vnode;
    const el = vnode.el = hostCreateElement(type);
    if (props) {
      for (const key in props) {
        hostPatchProp(el, key, null, props[key]);
      }
    }
    if (shapeFlag & 8 /* TEXT_CHILDREN */) {
      hostSetElementText(el, vnode.children);
    } else if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
      mountChildren(vnode.children, el, null);
    }
    hostInsert(el, container, anchor);
  };
  const mountChildren = (children, container, anchor) => {
    for (let i = 0; i < children.length; i++) {
      patch(null, children[i], container, anchor);
    }
  };
  const unmount = (vnode) => {
    if (vnode.type === Fragment) {
      unmountChildren(vnode.children);
    } else {
      hostRemove(vnode.el);
    }
  };
  const patchProps = (oldProps, newProps, el) => {
    if (oldProps !== newProps) {
      if (oldProps !== EMPTY_OBJ) {
        for (const key in oldProps) {
          if (!(key in newProps)) {
            hostPatchProp(el, key, oldProps[key], null);
          }
        }
      }
      for (const key in newProps) {
        const next = newProps[key];
        const prev = oldProps[key];
        hostPatchProp(el, key, prev, next);
      }
    }
  };
  const unmountChildren = (children) => {
    for (let i = 0; i < children.length; i++) {
      unmount(children[i]);
    }
  };
  const patchKeyedChildren = (c1, c2, el) => {
    let i = 0;
    const l2 = c2.length;
    let e1 = c1.length - 1;
    let e2 = l2 - 1;
    while (i <= e1 && i <= e2) {
      const n1 = c1[i];
      const n2 = c2[i];
      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, el);
      } else {
        break;
      }
      i++;
    }
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1];
      const n2 = c2[e2];
      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, el);
      } else {
        break;
      }
      e1--;
      e2--;
    }
    if (i > e1) {
      if (i <= e2) {
        const nextPos = e2 + 1;
        const anchor = nextPos < l2 ? c2[nextPos].el : null;
        while (i <= e2) {
          patch(null, c2[i], el, anchor);
          i++;
        }
      }
    } else if (i > e2) {
      while (i <= e1) {
        unmount(c1[i]);
        i++;
      }
    } else {
      const s1 = i;
      const s2 = i;
      const keyToNewIndexMap = /* @__PURE__ */ new Map();
      for (i = s2; i <= e2; i++) {
        const nextChild = c2[i];
        if (nextChild.key != null) {
          keyToNewIndexMap.set(nextChild.key, i);
        }
      }
      let j;
      let patched = 0;
      const toBePatched = e2 - s2 + 1;
      const newIndexToOldIndexMap = new Array(toBePatched).fill(0);
      for (i = s1; i <= e1; i++) {
        const prevChild = c1[i];
        if (patched >= toBePatched) {
          unmount(prevChild);
          continue;
        }
        let newIndex;
        newIndex = keyToNewIndexMap.get(prevChild == null ? void 0 : prevChild.key);
        if (newIndex === void 0) {
          unmount(prevChild);
        } else {
          newIndexToOldIndexMap[newIndex - s2] = i + 1;
          patch(prevChild, c2[newIndex], el, null);
          patched++;
        }
      }
      const increasingNewIndexSequence = getSequence(newIndexToOldIndexMap);
      console.log(increasingNewIndexSequence);
      j = increasingNewIndexSequence.length - 1;
      for (i = toBePatched - 1; i >= 0; i--) {
        let currentIndex = i + s2;
        let child = c2[currentIndex];
        let anchor = currentIndex + 1 < c2.length ? c2[currentIndex + 1].el : null;
        if (newIndexToOldIndexMap[i] == 0) {
          patch(null, child, el, anchor);
        } else {
          if (i != increasingNewIndexSequence[j] || j < 0) {
            hostInsert(child.el, el, anchor);
          } else {
            j--;
          }
        }
      }
    }
  };
  const patchChildren = (n1, n2, el, anchor) => {
    const c1 = n1.children;
    const c2 = n2.children;
    const prevShapeFlag = n1 ? n1.shapeFlag : 0;
    const shapeFlag = n2.shapeFlag;
    if (shapeFlag & 8 /* TEXT_CHILDREN */) {
      if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
        unmountChildren(c1);
      }
      if (c1 !== c2) {
        hostSetElementText(el, c2);
      }
    } else {
      if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
        if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
          patchKeyedChildren(c1, c2, el);
        } else {
          unmountChildren(c1);
        }
      } else {
        if (prevShapeFlag & 8 /* TEXT_CHILDREN */) {
          hostSetElementText(el, "");
        }
        if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
          mountChildren(c2, el, anchor);
        }
      }
    }
  };
  const patchElement = (n1, n2) => {
    const el = n2.el = n1.el;
    const oldProps = n1.props || {};
    const newProps = n2.props || {};
    patchProps(oldProps, newProps, el);
    patchChildren(n1, n2, el, null);
  };
  const patch = (n1, n2, container, anchor = null) => {
    if (n1 === n2)
      return;
    if (n1 && !isSameVNodeType(n1, n2)) {
      unmount(n1);
      n1 = null;
    }
    const { type, shapeFlag } = n2;
    switch (type) {
      case Text:
        processText(n1, n2, container, anchor);
        break;
      case Fragment:
        processFragment(n1, n2, container, anchor);
        break;
      default:
        if (shapeFlag & 1 /* ELEMENT */) {
          processElement(n1, n2, container, anchor);
        } else if (shapeFlag & 6 /* COMPONENT */) {
          processComponent(n1, n2, container, anchor);
        }
    }
  };
  const processText = (n1, n2, container, anchor) => {
    if (n1 == null) {
      hostInsert(
        n2.el = hostCreateText(n2.children),
        container,
        anchor
      );
    } else {
      const el = n2.el = n1.el;
      if (n2.children !== n1.children) {
        hostSetText(el, n2.children);
      }
    }
  };
  const processFragment = (n1, n2, container, anchor) => {
    if (n1 == null) {
      mountChildren(n2.children, container, anchor);
    } else {
      patchChildren(n1, n2, container, anchor);
    }
  };
  const processElement = (n1, n2, container, anchor) => {
    if (n1 == null) {
      mountElement(n2, container, anchor);
    } else {
      patchElement(n1, n2);
    }
  };
  const processComponent = (n1, n2, container, anchor) => {
    if (n1 == null) {
      mountComponent(n2, container, anchor);
    } else {
      updateComponent(n1, n2);
    }
  };
  const mountComponent = (initialVNode, container, anchor) => {
    const instance = initialVNode.component = createComponentInstance(initialVNode);
    setupComponent(instance);
    setupRenderEffect(instance, container, anchor);
  };
  const setupRenderEffect = (instance, container, anchor) => {
    const { render: render3 } = instance;
    const componentUpdateFn = () => {
      if (!instance.isMounted) {
        const subTree = render3.call(instance.proxy, instance.proxy);
        patch(null, subTree, container, anchor);
        instance.subTree = subTree;
        instance.isMounted = true;
      } else {
        const subTree = render3.call(instance.proxy, instance.proxy);
        patch(instance.subTree, subTree, container, anchor);
        instance.subTree = subTree;
      }
    };
    const effect = instance.effect = new ReactiveEffect(
      componentUpdateFn,
      () => queueJob(update)
      // 控制 componentUpdateFn 执行时机，可以批处理
    );
    const update = instance.update = effect.run.bind(effect);
    update();
  };
  const updateComponent = (n1, n2) => {
    const instance = n2.component = n1.component;
    const { props: prevProps } = n1;
    const { props: nextProps } = n2;
    updateProps(instance, prevProps, nextProps);
  };
  const render2 = (vnode, container) => {
    if (vnode == null) {
      unmount(container._vnode);
    } else {
      patch(container._vnode || null, vnode, container);
    }
    container._vnode = vnode;
  };
  return {
    render: render2
  };
}
function render(vnode, container) {
  const renderer = createRenderer(renderOptions);
  renderer.render(vnode, container);
}
function isVNode(value) {
  return value ? value.__v_isVNode === true : false;
}
var createVNode = (type, props, children = null) => {
  const shapeFlag = isString(type) ? 1 /* ELEMENT */ : isObject(type) ? 4 /* STATEFUL_COMPONENT */ : 0;
  const vnode = {
    __v_isVNode: true,
    type,
    props,
    key: props && props.key,
    el: null,
    children,
    shapeFlag
  };
  if (children) {
    let type2 = 0;
    if (isArray(children)) {
      type2 = 16 /* ARRAY_CHILDREN */;
    } else {
      children = String(children);
      type2 = 8 /* TEXT_CHILDREN */;
    }
    vnode.shapeFlag |= type2;
  }
  return vnode;
};
function h(type, propsOrChildren, children) {
  const l = arguments.length;
  if (l === 2) {
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      if (isVNode(propsOrChildren)) {
        return createVNode(type, null, [propsOrChildren]);
      }
      return createVNode(type, propsOrChildren);
    } else {
      return createVNode(type, null, propsOrChildren);
    }
  } else {
    if (l > 3) {
      children = Array.prototype.slice.call(arguments, 2);
    } else if (l === 3 && isVNode(children)) {
      children = [children];
    }
    return createVNode(type, propsOrChildren, children);
  }
}
function getSequence(arr) {
  const p = arr.slice();
  const result = [0];
  let i, j, u, v, c;
  const len = arr.length;
  for (i = 0; i < len; i++) {
    const arrI = arr[i];
    if (arrI !== 0) {
      j = result[result.length - 1];
      if (arrI > arr[j]) {
        p[i] = j;
        result.push();
        continue;
      }
      u = 0;
      v = result.length - 1;
      while (u < v) {
        c = u + v >> 1;
        if (arrI > arr[result[c]]) {
          u = c + 1;
        } else {
          v = c;
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1];
        }
        result[u] = i;
      }
    }
  }
  u = result.length;
  v = result[u - 1];
  while (u-- > 0) {
    result[u] = v;
    v = p[v];
  }
  return result;
}
export {
  Fragment,
  ShapeFlags,
  Text,
  createRenderer,
  createVNode,
  h,
  isVNode,
  render
};
//# sourceMappingURL=index.js.map
