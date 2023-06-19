## Async Components

[see](https://vuejs.org/guide/components/async.html#async-components)

根据官网：大型项目中，需要分割成小的代码块，按需加载（服务端），异步组件实现。


### 特性：
1. defineAsyncComponent 返回 promise(resolve, reject)服务端成功响应加载，则 resolve，失败reject即可。
2. ES module dynamic import动态引入返回的也是promise，通常作为代码分割点，tree-shaking。（vite和webpack）。
3. 可注册为全局组件或子组件
4. 参数可以是一个loader函数
5. 参数可以是一个options

```js
function defineAsyncComponent(
  source: AsyncComponentLoader | AsyncComponentOptions
): Component

type AsyncComponentLoader = () => Promise<Component>

interface AsyncComponentOptions {
  loader: AsyncComponentLoader
  loadingComponent?: Component
  errorComponent?: Component
  // 间隔x秒后，展示loadingComponent，避免网速过快，loadingComponent被快速替换成loader组件，造成闪屏
  delay?: number
  // 超时或者loader结果reject
  timeout?: number
  suspensible?: boolean
  onError?: (
    error: Error,
    // 失败后，可以重试
    retry: () => void,
    fail: () => void,
    attempts: number
  ) => any
}
```