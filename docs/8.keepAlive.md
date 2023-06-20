## KeepAlive

### 特性
- 内置组件
- 缓存子组件渲染的真实DOM，放在cacheContainer内存中，
- deactive函数调用之后，shapeFlag 标记为 COMPONENT_SHOULD_KEEP_ALIVE，被标记好之后remove到cacheContainer中，而不会走mounted/unmount钩子函数
- 被激活之后，再次被拿出来，移动到页面DOM中，shapeFlag标记为COMPONENT_KEPT_ALIVE
- max属性，根据LRU规则，决定缓存的个数。