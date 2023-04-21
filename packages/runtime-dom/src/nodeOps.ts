const doc = typeof document !== 'undefined' ? document : null

export const nodeOps = {
  insert: (child, parent, anchor) => {
    // parent.insertBefore(child, parent, anchor || null)
    parent.appendChild(child)
  },

  remove: child => {
    const parent = child.parentNode
    if (parent) {
      parent.removeChild(child)
    }
  },

  createElement: tag => doc.createElement(tag),

  createText: text => doc.createTextNode(text),

  createComment: text => doc.createComment(text),

  setText: (node, text) => {
    node.nodeValue = text
  },

  setElementText: (el, text) => {
    el.textContent = text
  },

  parentNode: node => node.parentNode,

  nextSibling: node => node.nextSibling,

  querySelector: selector => doc.querySelector(selector)
}