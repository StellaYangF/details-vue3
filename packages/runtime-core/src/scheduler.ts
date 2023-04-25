const queue = []
let isFlushing = false
const resolvedPromise = Promise.resolve()

export function queueJob(job) {
  if (!queue.includes(job)) {
    queue.push(job)
  }

  if (!isFlushing) {
    isFlushing = true
    resolvedPromise.then(() => {
      isFlushing = false
      const copy = queue.slice()
      queue.length = 0 // 这里要先清空，防止在执行过程中在加入新的job
      for (let i = 0; i < queue.length; i++) {
        let job = queue[i]
        job()
      }
      copy.length = 0
    })
  }

}