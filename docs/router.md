## Router

路由系统：
1. 记录跳转的路径和跳转时携带的数据
2. 实现跳转或替换 (go, back, forward, replace)
3. 监听路径变化，动态渲染路由匹配的组件

### 路由方式

- hash：(#锚点方式)
- history：H5 API
- memory：内存型，不会修改url地址

### 优缺点

打开百度网站，F12 输入 location
```js
// protocol://username:password@host:port/pathname + search + hash
location = {
  ancestorOrigins,
  assign,
  hash : "#hello"", // 锚点
  host : "www.baidu.com",
  hostname : "www.baidu.com",
  href : "https://www.baidu.com/",
  origin : "https://www.baidu.com",
  pathname : "/", // 路由
  port : "",
  protocol : "https:",
  reload,
  replace,
  search,
}
```

hash
- 丑，加了#
- 不支持SEO
- 无法做SSR，因为hash是前端锚点，requestURL 不包含锚点
- 刷新发请求，不会出现404
- 兼容性好
- 简单

history
- 好看
- 支持SEO
- 支持SSR
- 刷新发请求，没有对应资源，会出现404；续服务端配置，重定向到首页，前端自己根据pathname决定渲染页面是。
- 兼容性现在也基本没有了

### 如何实现

**背景**
hash: hashchange事件 + window.location.hash + popstate
history: history.pushState(自己跳转得) + popstate 事件（监听浏览器得前进后退）

History.prototype
  - go
  - forward
  - back
  - pushState
  - replaceState
  - state
  - length

vue3 整合了，使用pushState + popstate，不考虑兼容性，只区分#有无。

- replaceState： 栈中替换
- pushState: 栈中新增

**核心API**

路径+状态(locationState + historyState)
- createWebHistory
- createWebHash
- push
- replace
- listen

### 路由守卫

#### 执行顺序
1. 导航触发
2. 失活的组件调用 beforeRouteLeave
3. 全局 beforeEach
4. 重用的组件调用 beforeRouteUpdate
5. 路由配置 beforeEnter
6. 解析异步路由组件
7. 被激活的组件 beforeRouteEnter
8. 全局 beforeResolve
9. 导航确认
10. 全局 afterEach
11. 触发 DOM 更新
12. 调用 beforeRouteEnter 守卫中传给 next 的回调函数，创建好的组件实例会作为回调函数的参数传入

#### 守卫分类

- leavingRecords: promiseGuard[]
- updatingRecords: promiseGuard[]
- enteringRecords: promiseGuard[]

#### 将用户传入的 guard 包装成 promise

每个guard都返回一个回调函数，内部返回 new Promise，方便后续串行执行

```js
const guardToPromise => (guard, from, to, record) => {
  // 返回函数的目的，是为了下一步组合所有的guard
  return () => new Promise(resolve => {
     // 用户可调用，返回的 promise 标记成功
    const r = guard.call(record, to, from, resolve)
    // 用户不调用 resolve/ next，guardPromise 也会自行调用，并传入用户返回的参数
    Promise.resolve(r).then(resolve)
  })
}
```

#### 组合所有的 guards，保证顺序执行
类似 Koa, redux 串行执行
```js
const runGuardQueue = records => {
  records.reduce((promise, record) => {
    const p = promise.then(record)
    return p
  }, Promise.resolve())
}
```