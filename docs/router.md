## Router

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