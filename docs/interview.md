## Vue面试题

### Vue3新增哪些特性
- CompositionAPI
  - 使用函数编写组件，最终可以组合在一起
  - 
  - 
- teleport: 传送门，用于操作DOM树，使用场景可以是模态框
- 编译优化：
  - 引入patchFlag，template模板编译时，会运用openBlock，标记动态属性、动态节点，存放在dynamicChildren中，组件更新时，只用比对dynamicChildren中的动态节点即可，针对非全量diff算法，性能有所提升。
  - ? longestIncreasingSubsequence最长递增子序列，最大程度复用元素节点，移动变动节点。
- 
- createRenderer 可以创建自定义渲染器，用于跨平台 runtime-core。runtime-dom提供的是浏览器DOM操作API

### Vue2和Vue3核心diff算法区别

- 全量diff算法，整体来说性能差异不大
- 默认都是采用同级比较+深度递归得方式进行比较
- vue3对比vue2性能优化，主要在编译过程中添加patchFlag，产生对应得block节点，进行动态节点的收集，更新时只比较dynamicChildren动态节点，减少了递归比较的方式
- vue3中拥有最长递增子序列得算法，优化了移动复用节点得频率
- diff算法原理：
  1. 先比较根节点 isSameVnode
  2. 不是相同节点，删除创建新节点
  3. 是相同节点，复用比较属性和儿子
  4. 儿子：一方有，一方无，两方都无，两方都有
  5. 都有，才走到diff核心，先比头再比尾，是相同子节点，则直接复用属性和儿子
  6. 不是相同子节点，则采用最长递增子序列，进行优化复用节点


### 为什么要重构Vue2？

- 性能更好
- 代码体积更小
- ts支持

### watchEffect和watch区别
- watchEffect: 等价于effect，watch就是基于effect封装的自定义scheduler
- watchEffect 传递的是一个立即执行函数，被动追踪依赖的值，值变化会性能重新执行此方法。
- watch 监控某个值的变化，也可能是一个响应式对象（性能差，会递归取值，收集依赖进行监控），数据变化触发对应得回调。

### reactive, ref, toRef, toRefs, proxyRefs区别
- reactive: 将对象转为响应式数据，内部是new Proxy返回代理对象，页面渲染取值时，代理对象会收集依赖，存放属性对应的组件渲染函数（也有可能是setup函数，每一个组件就是一个effect）。当属性值改变，触发依赖执行，也就是渲染函数执行，走到patch流程中。页面更新，会取到最新得属性值。

- ref(value: simpleValue|object): 创建一个包装对象 ReImpl采用类得属性访问器，将简单得值包装成一个响应式对象。通过该对象.value访问值，访问时收集依赖。修改.value值触发更新。如果传入的是对象，也会采用reactive来实现

- toRef: 基于reactive将某个属性转为ref
- toRefs: 基于reactive将所有属性转为ref对象 `ref[key].value`
- proxyRefs: 创建一个代理对象，改写get/set，传入响应式数据，reactive对象则Reflect.get()取值返回；ref对象，则会帮忙取.value值


### v-for和v-if优先级

同一个节点，使用for和if，从编译结果看，if的优先级更高（其实是当作判断对象，进行渲染for节点），导致先拿到了for中声明的变量item,if中是拿不到的，导致编译时报错。

正确的方式，是计算属性来代替，避免在每一轮渲染item时，判断一次是否渲染，浪费性能。

### v-show和v-if区别

- v-show: 控制的样式，通过设置样式属性display为none, 隐藏掉元素，显示则是保留原来的display值,初始条件不管是啥，元素都会渲染。会有首次渲染成本
- v-if: 控制元素的显示隐藏，可以阻段后续的代码执行，条件不成立，就不会执行后续逻辑。（DOM树中不存在这个子元素）

- 页面首次加载时，可以确定的展示与否时用if,频繁切换则是show

[*see vuejs.org*](https://vuejs.org/guide/essentials/conditional.html#v-if-vs-v-show)

> 涉及css：opacity, visibility, display


### 组件间通信

- 父子：attrs, 
- 子父: emit, 
- 兄弟： provide
- 

### 异步组件，suspense

### 生命周期函数

### 如何看待pinia

### 路由系统

### keep-alive缓存后如何更新


