export function renderList(
  source: any,
  renderItem
) {
  let ret = []

  for (let i = 0, l = source.length; i < l; i++) {
    ret[i] = renderItem(source[i], i, undefined)
  }
  return ret
}