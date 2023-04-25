export const Text = Symbol.for('v-text')
export const Fragment = Symbol.for('v-fgt') as any as {
  __isFragment: true,
  new(): {
    $props: any
  }
}