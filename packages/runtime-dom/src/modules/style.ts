export function patchStyle(el: Element, prev, next) {
  const style = (el as HTMLElement).style

  // add next style
  for (const key in next) {
    style[key] = next[key]
  }

  // remove previous style which not in next style
  for (const key in prev) {
    if (next[key] == null) {
      style[key] = null
    }
  }
}