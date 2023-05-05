export const enum PatchFlags {
  TEXT = 1, // 动态文本节点
  CLASS = 1 << 1, // 动态class
  STYLE = 1 << 2, // 动态style
  PROPS = 1 << 3, // 除class/style
  FULL_PROPS = 1 << 4, // 有key，需要完整diff
  HYDRATE_EVENTS = 1 << 5, // 挂载过事件的
  STABLE_FRAGMENT = 1 << 6, //稳定序列，子节点顺序不会发生变化
  KEYED_FRAGMENT = 1 << 7,  // 子节点由key的fragment
  UNKEYED_FRAGMENT = 1 << 8,
  NEED_PATCH = 1 << 9, // 进行非props比较，ref比较
  DYNAMIC_SLOTS = 1 << 10, // 动态插槽
  DEV_ROOT_FRAGMENT = 1 << 11,
  HOISTED = -1, // 静态节点，内容变化，不比较子节点
  BAIL = -2 // 结束diff算法，跳过
}