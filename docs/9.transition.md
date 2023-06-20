## transition 

Vue内置组件

### 用法：
1. 渲染的子组件应该是两个不同的tag元素，避免只是覆盖了props.styles属性
2. Transition 是函数式组件
3. requestAnimationFrame 可以获取渲染帧，不同浏览器实现方案不同，有的是在当前帧的尾部，有的是在下一帧的头部。为确保在下一帧执行，会采用nextFrame函数，（onBeforeEnter, onEnter防止前后添加移除的类名同步执行）
4. 每一帧是16.6ms，为保证动画更流畅，每一帧尽量都有动画
  - 而不是在onBeforeEnter添加的enterFrom,enterActive，到了onEnter添加的enterTo，类名覆盖掉。
  - 如：opacity变化：enterFrom 0, enterActive 0.5, enterTo 1, 如果在同一帧渲染绘制，则没有0=>0.5=>1 的变化过程，上来就是1了。
5. 本质就是，添加移除类名 el.classList.add/remove
6. 子啊
7. hooks分类
  - onBeforeEnter
  - onEnter
  - onBeforeLeave
  - onLeave
  - enterFromClass
  - enterActiveClass
  - enterToClass
  - leaveFromClass
  - leaveActiveClass
  leaveToClass

### 钩子函数流程
cl = el.classList

from -> active -> to

onBeforeEnter: 
- onBeforeEnter && onBeforeEnter(el)
- cl.add(enterFromClass, enterActiveClass)

onEnter(el): **nextFrame = cb => requestAnimation(() => requestAnimation(cb))** 拿到下一帧再进行移除，保证类名添加完成之后。
- done
  - cl.remove(enterActiveClass, enterToClass)
- onEnter && onEnter(el, done)
- nextFrame(cb)
  - cl.remove(enterFromClass)
  - cl.add(enterToClass)
  - !onEnter || onEnter.length <= 1 (el.addEventListener('transitionend', done), H5事件)

onBeforeLeave:

onLeave(el, done): 
- resolveDone
  - cl.remove(leaveActiveClass, leaveToClass)
  - done() // unmount，移除真实节点
- cl.add(leaveFrom)
- **document.body.offsetHeight** 
  - 强制重绘下，重新计算宽高，保证样式leaveFromClass都添加完了，再添加leaveActiveClass
- cl.add(leaveActiveClass)
- nextFrame
  - cl.remove(leaveFromClass)
  - cl.add(leaveToClass)
  - !onLeave || onLeave.length <= 1 (el.addEventListener('transitionend', resolveDone), H5事件)
- onLeave && onLeave(resolveDone)

### patch 函数更改

用户提供的hooks，会给组件实例添加transition属性，存放对应得钩子函数，

在mount和unmount操作真实节点前后，分别触发onEnter和onLeave钩子函数执行。
