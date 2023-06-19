# 组件渲染 mountComponent

此前，已经研究到 DOM 渲染，属于 runtime-core 包，根据 runtime-dom 提供的操作DOM 相关 API，以及属性的比对方式。实际是调用 createRenderer(options).render(VDOM, container)。

VDOM 由 h/ createVNode 生成的虚拟DOM树，

## 本质
单文件组件（Single-File Component）是一种特殊的文件格式，可以整合template, logic, styling在此文件中，编译器会将template模板编译成render函数，返回虚拟DOM树

如下代码
```js
template.file
<div>
  <h1>Hello Stella</h1>
  <span>{{name}}</span>
</div>

compiled code

const { 
  createElementVNode: _createElementVNode,
  toDisplayString: _toDisplayString,
  createTextVNode: _createTextVNode,
  openBlock: _openBlock,
  createElementBlock: _createElementBlock 
} = Vue

return function render(_ctx, _cache, $props, $setup, $data, $options) {
  return (_openBlock(), _createElementBlock("div", null, [
    _createElementVNode("h1", null, "Hello Stella"),
    _createTextVNode(),
    _createElementVNode("span", null, _toDisplayString(_ctx.name), 1 /* TEXT */)
  ]))
}
```
s
## 流程

1. 初始化一个实例 createComponentInstance
2. 初始化属性 setupComponent()
3. 创建渲染 effect createComponentEffect()


## 核心
组件创建方式，由两种：

1. optionsAPI
```js
const A = {
  data() {
    return { name: 'Stella' }
  },
  props: { },
  render(proxy) { // proxy 为组件实例的代理对象，代理属性取值和更新，如 props, attrs, state...
    return h() // VDOM

  }
}
```

2. compositionAPI
- setup 方法有两种方式，数据或render函数
- 其中返回的是 render 函数，接收参数（props, ctx(emit, attrs, expose, slots)）
- expose 和 ref 结合使用，子组件默认暴露所有的属性，而定义 ref 之后，指定暴露部分的属性

```js
const Child = {
  setup() {
    // 运用 compositionAPI 可以复用逻辑，useCounter()
    const count = reactive({ count: 0 })
    const double = computed(() => count.count 8 * 2)
  
    // 1. return data
    return ...toRefs()

    // OR return render
    return (props, ctx) => {
      ctx.emit('eventName', 'xxx')
    }

  },
  // 这里的 render 接收的是组件实例的代理对象
  render(proxy) {
    return h()
  }
}

render(Child, {
  'onEventName': (prop) => console.log(prop) 
}, 'app')
```

## 异步组件

1. 本质就是一个组件，调用 defineAsyncComponent 返回一个动态的组件
2. 根据传入的 loader（是一个异步调用的函数，在某一时刻执行），结果回来前后，分别展示不同的组件
3. 用户可自行定义展示组件。

defineAsyncComponent