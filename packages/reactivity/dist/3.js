const school = {
  students: 100,
  teachers: 200,
  get total() {
    return this.students + this.teachers
  }
}

const p = new Proxy(school, {
  get(target, key, receiver) {
    console.log(`Get ${key} ----`)
    // return target[key]

    // 绑定 school.total 取值(this.students + this.teachers)时内部的 this 会绑定为代理后的 p 对象 
    return Reflect.get(target, key, receiver)
  },
  set(target, key, value, receiver) {
    console.log(`Set ${key} ----`)
    return target[key] = value
  }
})

console.log(p.total)

/**
 * Proxy 不用 Reflect 时，则只会触发 total 在代理取值时的操作，this指向的是 school
 * Get total ----
 * 300
 * 
 * 使用 Reflect 时，this 则指向代理对象 p
 * Get total ----
 * Get students ----
 * Get teachers ----
 * 300
 */
