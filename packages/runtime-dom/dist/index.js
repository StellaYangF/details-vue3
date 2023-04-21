// packages/runtime-dom/src/nodeOps.ts
var doc = typeof document !== "undefined" ? document : null;
var nodeOps = {
  insert: (child, parent, anchor) => {
    parent.appendChild(child);
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

// packages/shared/src/generals.ts
var isArray = Array.isArray;
var onRE = /^on[^a-z]/;
var isOn = (key) => onRE.test(key);

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
    if (next[key] == null) {
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
export {
  renderOptions
};
//# sourceMappingURL=index.js.map
