/** 最长递增子序列 **/
// 二分查找
// 树的前驱节点追溯
// 核心：后一项记住前一项下标，末尾倒叙查找。性能高

// 从第一项开始，一个个查找，存入 result 数组中
// 每拿出一项，比对：若比最后一项大，则追加；否则，替换比这个数值第一大的元素。
// 标记下标，最终返回索引值


function getSequence(arr) {
  const len = arr.length;
  const result = [0]; // 索引  递增的序列 用二分查找性能高
  const p = arr.slice(0); // 里面内容无所谓 和 原本的数组相同 用来存放索引
  let start;
  let end;
  let middle;
  for (let i = 0; i < len; i++) { // O(n)
    const arrI = arr[i];
    if (arrI !== 0) {
      let resultLastIndex = result[result.length - 1];
      if (arr[resultLastIndex] < arrI) {
        p[i] = resultLastIndex; // 标记当前前一个对应的索引
        result.push(i);
        // 当前的值 比上一个人大 ，直接push ，并且让这个人得记录他的前一个
        continue
      }
      // 二分查找 找到比当前值大的那一个
      start = 0;
      end = result.length - 1;
      while (start < end) { // 重合就说明找到了 对应的值  // O(logn)
        middle = ((start + end) / 2) | 0; // 找到中间位置的前一个
        if (arr[result[middle]] < arrI) {
          start = middle + 1
        } else {
          end = middle
        } // 找到结果集中，比当前这一项大的数
      }
      // start / end 就是找到的位置
      if (arrI < arr[result[start]]) { // 如果相同 或者 比当前的还大就不换了
        if (start > 0) { // 才需要替换
          p[i] = result[start - 1]; // 要将他替换的前一个记住
        }
        result[start] = i;
      }
    }
  }
  let i = result.length // 总长度
  let last = result[i - 1] // 找到了最后一项
  while (i-- > 0) { // 根据前驱节点一个个向前查找
    result[i] = last // 最后一项肯定是正确的
    last = p[last]
  }
  return [result, p];
}

const arr = [2, 3, 1, 5, 6, 8, 7, 9, 4] // [1, 3, 5]/[2, 1, 3] <- 6, i = 4
// 2                                 result值
// 2 3 (取1, 2 > 1, 2替换为1)           [0]
// 1 3                                  [0]
// 1 3 5                                [0, 1]
// 1 3 5 6                              [0, 1, 3]
// 1 3 5 6 8                            [0, 1, 3, 4]
// 1 3 5 6 7                            [0, 1, 3, 4]
// 1 3 5 6 7 9                          [0, 1, 3, 4, 6]
// 1 3 4 6 7 9                          [0, 1, 3, 4, 6]
// 最后9对应的索引7一定是最大的，加上    [0, 1, 3, 4, 6, 7]
console.log(getSequence(arr)) // 索引列表[0, 1, 3, 4, 6, 7] -> 对应数组[2,3,5,6,7,9]


function getSeq(arr) {

  const result = [0]
  const len = arr.length
  let resultLastIndex

  for (let i = 0; i < len; i++) {
    const arrI = arr[i]
    if (arrI !== 0) {
      resultLastIndex = result[result.length - 1]
      if (arrI > arr[resultLastIndex]) {
        result.push(i)
        continue
      }
    }
  }
  return result
}
console.log(getSeq(arr))
