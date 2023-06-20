## ref 相关

### 背景 ref
1. `proxy` 代理的目标必须是非原始值，所以 `reactive` 不支持原始值类型
2. `Ref` 将原始值类型进行包装
3. 返回 `RefImpl` 进行管理
4. 访问器属性，取值和更新时，收集依赖与触发更新操作
5. 区分 ref 和 shallowRef，单层代理

### 代码实现
![ref](./assets/ref.png)

### toRef(s)

代理对象结构之后，会丢失响应式更新操作。可通过 toRef(s) 实现

![toRef](./assets/toRef.png)

### proxyRefs

自动去掉 ref.value，template 模板帮忙做了操作
![proxyRefs](./assets/proxyRefs.png)

