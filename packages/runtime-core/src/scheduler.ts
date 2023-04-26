const queue = []
let isFlushing = false
const resolvedPromise = Promise.resolve()

// 防止一更新数据就触发更新,批量处理
export function queueJob(job) {
  if (!queue.includes(job)) {
    // 一个组件依赖的多个数据时，多数据更新,任务队列中只会压入一次
    queue.push(job)
  }

  // 数据更新，可能会出现多个组件更新，采用队列存储
  if (!isFlushing) {
    isFlushing = true
    // promise 微任务，等当前同步任务执行完成后，再执行
    resolvedPromise.then(() => {
      isFlushing = false
      const copy = queue.slice()
      // 这里要先清空，防止在执行过程中在加入新的job，直到当前job都执行完，再开始新一轮任务
      queue.length = 0
      copy.forEach(job)
      copy.length = 0 // 执行完，清空副本
    })
  }

}

//类似浏览器的事件环：(同步任务, 微任务, 宏任务)
// 一轮一轮，执行过程中还会新增新的任务，先缓存入队列中