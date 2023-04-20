## computed 计算属性

### 特性

1. 主要是根据其他数据进行衍生数据
2. 懒执行，若依赖的值不发生变化，不会重新执行，`dirty` 缓存
  ```js
    const state = reactive({ firstname: 'Stella', lastname: 'Yang' })

    const fullname = computed({
      get() {
        // 读取多次，get 取值器只会触发一次，数据dirty，再次读取再次触发
        console.log('get fullname')
        return state.firstname + ' ' +  state.lastname
      }, 
      set(newVal) {
        console.warn('Computed data cannot be changed.')
      }
    })

    
    app.innerHTML = fullname.value
    fullname.value
    fullname.value
    fullname.value
  

    state.firstname = 'Fan'
  ```
3. 自身无法修改
4. 依赖的数据变化，后续再取值会获取新值，不是 `effect` 不会触发更新，再次取值获取新值

### 代码实现

1. 内部也是依赖 `ReactiveEffect`
2. 实例化 `reactiveEffect` 时，接收两个参数
3. 参数一为 `getter` 取值收集依赖，`getter` 内部返回的 `reactive` 包装后的代理 `data`，（类似 `watch` 方法）
4. 参数二为 `scheduler`，数据更新，`dirty`置为 `true`，同时触发收集的 `effect` 执行
5. 计算属性也属于响应式数据，只有在 `effect`->  `activeEffect`，回调中取值才会收集依赖；在 `effect` 之外取值，数据更新时不触发 `effect` 执行。

```js
import { isFunction } from "@vue/shared";
import { ReactiveEffect, activeEffect, trackEffects, triggerEffects } from "./effect";

class ComputedRefImpl {
  public _dirty = true
  public _value
  public dep
  public effect
  constructor(getter, public setter) {
    this.effect = new ReactiveEffect(getter, () => {
      this._dirty = true

      // 数据更新时，触发effect执行
      triggerEffects(this.dep)
    })
  }

  get value() {
    // 取值收集依赖：在 effect 中使用时，单独做依赖收集
    if (activeEffect) {
      trackEffects(this.dep || (this.dep = new Set()))
    }

    // 懒执行-数据不变缓存
    if (this._dirty) {
      this._value = this.effect.run()
      this._dirty = false
    }
    return this._value
  }

  set vlaue(newVal) {
    this.setter(newVal)
  }
}

export function computed(getterOptions) {
  let getter
  let setter
  if (isFunction(getterOptions)) {
    getter = getterOptions
  } else {
    getter = getterOptions.get
    setter = getterOptions.set
  }

  return new ComputedRefImpl(getter, setter)
}
```