## 模板编译原理
Diff 算法无法避免新旧虚拟 DOM 中无用的比较操作，通过 patchFlags 来标记动态内容，实现靶向更新，可快速 diff 算法
```html
<div>
  <h1>Hello Stella</h1>
  <span>{{ name }}</span>
</div>
```

此 template 经过模板编译会变成以下代码：
[*template-explorer*](https://template-explorer.vuejs.org/#eyJzcmMiOiI8ZGl2PlxyXG4gIDxoMT5IZWxsbyBTdGVsbGE8L2gxPlxyXG4gIDxzcGFuPnt7IG5hbWUgfX08L3NwYW4+XHJcbjwvZGl2PiIsIm9wdGlvbnMiOnt9fQ==)
```js
import { createElementVNode as _createElementVNode, toDisplayString as _toDisplayString, openBlock as _openBlock, createElementBlock as _createElementBlock } from "vue"

export function render(_ctx, _cache, $props, $setup, $data, $options) {
  return (_openBlock(), _createElementBlock("div", null, [
    _createElementVNode("h1", null, "Hello Stella"),
    _createElementVNode("span", null, _toDisplayString(_ctx.name), 1 /* TEXT */)
  ]))
}

// Check the console for the AST
```

- 该 render 函数生成的 vnode，多出一个 `dynamicChildren`（由block收集所有后代动态节点）。
- 性能可被大幅度提升,从 tree 级别的比对，变成了线性结构比对。
- 这样后续更新时可以直接跳过静态节点，实现靶向更新。
- `.vue` 文件编写的 `template` 组件，会利用此方式做优化。
- `.jsx` 文件，则无法享受此优化。除非是自己手动编写 _openBlock 代码段。

### PatchFlags动态标识
```js
export const enum PatchFlags {
  TEXT = 1, // 动态文本节点
  CLASS = 1 << 1, // 动态class
  STYLE = 1 << 2, // 动态style
  PROPS = 1 << 3, // 除class/style
  FULL_PROPS = 1 << 4, // 由key，需要完整diff
  HYDRATE_EVENTS = 1 << 5, // 挂载过事件的
  STABLE_FRAGMENT = 1 << 6, //稳定序列，子节点顺序不会发生变化
  KEYED_FRAGMENT = 1 << 7,  // 子节点由key的fragment
  UNKEYED_FRAGMENT = 1 << 8,
  NEED_PATCH = 1 << 9, // 进行非props比较，ref比较
  DYNAMIC_SLOTS = 1 << 10, // 动态插槽
  DEV_ROOT_FRAGMENT = 1 << 11,
  HOISTED = -1, // 静态节点，内容变化，不比较子节点
  BAIL = -2 // 结束diff算法
}
```

### 靶向更新实现
性能可被大幅度提升,从 tree 级别的比对，变成了线性结构比对。

```js
const patchElement = (n1, n2) => {
  const el = n2.el = n1.el

  const oldProps = n1.props || {}
  const newProps = n2.props || {}

  // 根据patchFlag细化patch类型
  const { patchFlag } = n2
  if (patchFlag) {
    if (patchFlag & PatchFlags.CLASS) {
      hostPatchProp(el, 'class', null, newProps.class)
    }
    if (patchFlag & PatchFlags.TEXT) {
      if (n1.children !== n2.children) {
        hostSetElementText(el, n2.children)
      }
    }
  } else {
    patchProps(oldProps, newProps, el)
  }

  if (n2.dynamicChildren) {
    patchBlockChildren(n1, n2)
  } else {
    patchChildren(n1, n2, el, null)
  }
}
```

```js
const patchBlockChildren = (n1, n2) => {
  for (let i = 0; i < n2.dynamicChildren; i++) {
    patchElement(n1.dynamicChildren[i], n2.dynamicChildren[n2])
  }
}
```

### BlockTree
为什么我们还要提出 blockTree 的概念？ 只有 block 不就挺好的么？ 问题出在 block 在收集动态节点时是忽略虚拟 DOM 树层级的。

```js
<div>
    <p v-if="flag">
        <span>{{a}}</span>
    </p>
    <div v-else>
        <span>{{a}}</span>
    </div>
</div>
```

> 这里我们知道默认根节点是一个block节点，如果要是按照之前的套路来搞，这时候切换flag的状态将无法从p标签切换到div标签。 解决方案：就是将不稳定的结构也作为block来进行处理

