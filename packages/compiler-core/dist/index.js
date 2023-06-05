// packages/compiler-core/src/codegen.ts
function generate(ast) {
}

// packages/compiler-core/src/parse.ts
function createParserContext(content) {
  return {
    line: 1,
    column: 1,
    offset: 0,
    source: content,
    originalSource: content
  };
}
function baseParse(content) {
  const context = createParserContext(content);
  const start = getCursor(context);
  return createRoot(
    parseChildren(context),
    getSelection(context, start)
  );
}
function createRoot(children, loc) {
  return {
    type: 0 /* ROOT */,
    children,
    loc,
    helpers: /* @__PURE__ */ new Set()
  };
}
function parseChildren(context) {
  const nodes = [];
  while (!isEnd(context)) {
    const s = context.source;
    let node;
    if (s.startsWith("{{")) {
      node = parseInterpolation(context);
    } else if (s[0] === "<") {
      node = parseElement(context);
    }
    if (!node) {
      node = parseText(context);
    }
    nodes.push(node);
  }
  return nodes;
}
var isEnd = (context) => {
  const source = context.source;
  if (context.source.startsWith("</")) {
    return true;
  }
  return !source;
};
function parseText(context) {
  const endTokens = ["<", "{"];
  let endIndex = context.source.length;
  for (let i = 0; i < endTokens.length; i++) {
    const index = context.source.indexOf(endTokens[i], 1);
    if (index !== -1 && endIndex > index) {
      endIndex = index;
    }
  }
  let start = getCursor(context);
  const content = parseTextData(context, endIndex);
  return {
    type: 2 /* TEXT */,
    content,
    loc: getSelection(context, start)
  };
}
function getCursor(context) {
  const { column, line, offset } = context;
  return { column, line, offset };
}
function parseTextData(context, endIndex) {
  const rawText = context.source.slice(0, endIndex);
  advanceBy(context, endIndex);
  return rawText;
}
function advanceBy(context, numberOfCharacters) {
  const s = context.source;
  advancePositionWithMutation(context, s, numberOfCharacters);
  context.source = s.slice(numberOfCharacters);
}
function advancePositionWithMutation(pos, source, numberOfCharacters) {
  let linesCount = 0;
  let linePos = -1;
  for (let i = 0; i < numberOfCharacters; i++) {
    if (source.charCodeAt(i) === 10) {
      linesCount++;
      linePos = i;
    }
  }
  pos.offset += numberOfCharacters;
  pos.line += linesCount;
  pos.column = linePos === -1 ? pos.column + numberOfCharacters : numberOfCharacters - linePos;
  return pos;
}
function getSelection(context, start, end) {
  end = end || getCursor(context);
  return {
    start,
    end,
    source: context.originalSource.slice(start.offset, end.offset)
  };
}
function parseInterpolation(context) {
  const [open, close] = ["{{", "}}"];
  const closeIndex = context.source.indexOf(close, open.length);
  if (closeIndex === -1) {
    return void 0;
  }
  const start = getCursor(context);
  advanceBy(context, open.length);
  const innerStart = getCursor(context);
  const innerEnd = getCursor(context);
  const rawContentLength = closeIndex - open.length;
  const rawContent = context.source.slice(0, rawContentLength);
  const preTrimContent = parseTextData(context, rawContentLength);
  const content = preTrimContent.trim();
  const startOffset = preTrimContent.indexOf(content);
  if (startOffset > 0) {
    advancePositionWithMutation(innerStart, rawContent, startOffset);
  }
  const endOffset = rawContentLength - (preTrimContent.length - content.length - startOffset);
  advancePositionWithMutation(innerEnd, rawContent, endOffset);
  advanceBy(context, close.length);
  return {
    type: 5 /* INTERPOLATION */,
    content: {
      type: 4 /* SIMPLE_EXPRESSION */,
      isStatic: false,
      content,
      loc: getSelection(context, innerStart, innerEnd)
    },
    loc: getSelection(context, start)
  };
}
function parseElement(context) {
  const ele = parseTag(context, 0 /* Start */);
  const children = parseChildren(context);
  if (context.source.startsWith("</")) {
    parseTag(context, 1 /* End */);
  }
  ele.loc = getSelection(context, ele.loc.start);
  ele.children = children;
  return ele;
}
function parseTag(context, type) {
  const start = getCursor(context);
  const match = /^<\/?([a-z][^\t\r\n\f />]*)/i.exec(context.source);
  const tag = match[1];
  advanceBy(context, match[0].length);
  advanceSpaces(context);
  const isSelfClosing = context.source.startsWith("/>");
  advanceBy(context, isSelfClosing ? 2 : 1);
  if (type === 1 /* End */) {
    return;
  }
  return {
    type: 1 /* ELEMENT */,
    tag,
    isSelfClosing,
    loc: getSelection(context, start)
  };
}
function advanceSpaces(context) {
  const match = /^[\t\r\n]+/.exec(context.source);
  if (match) {
    advanceBy(context, match[0].length);
  }
}

// packages/shared/src/generals.ts
var isArray = Array.isArray;
var isString = (val) => typeof val === "string";

// packages/compiler-core/src/runtimeHelpers.ts
var TO_DISPLAY_STRING = Symbol(``);

// packages/compiler-core/src/transform.ts
function transform(root) {
  const context = createTransformContext(root);
  traverseNode(root, context);
}
function createTransformContext(root) {
  const context = {
    root,
    currentNode: root,
    parent: null,
    nodeTransforms: [
      transformElement,
      transformText,
      transformExpression
    ],
    helpers: /* @__PURE__ */ new Map(),
    // record transforms call nums
    helper(name) {
      const count = context.helpers.get(name) || 0;
      context.helpers.set(name, count + 1);
      return name;
    },
    removeHelper(name) {
      const count = context.helpers.get(name);
      if (count) {
        const currentCount = count - 1;
        if (!currentCount) {
          context.helpers.delete(name);
        } else {
          context.helpers.set(name, currentCount);
        }
      }
    },
    childIndex: 0,
    onNodeRemoved: () => {
    },
    removeNode(node) {
      const list = context.parent.children;
      const removalIndex = node ? list.indexOf(node) : context.currentNode ? context.childIndex : -1;
      if (!node || node === context.currentNode) {
        context.currentNode = null;
        context.onNodeRemoved();
      } else {
        if (context.childIndex > removalIndex) {
          context.childIndex--;
          context.onNodeRemoved();
        }
      }
      context.parent.children.splice(removalIndex, 1);
    }
  };
  return context;
}
function transformElement(node) {
  if (node.type === 1 /* ELEMENT */) {
    return function postTransformElement() {
      console.log("transform element", node);
    };
  }
}
function transformText(node) {
  if (node.type === 1 /* ELEMENT */ || node.type === 0 /* ROOT */) {
    return () => {
      let hasText = false;
      const children = node.children;
      const currentContainer = void 0;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
      }
    };
  }
}
function transformExpression(node) {
  if (node.type === 5 /* INTERPOLATION */) {
    node.content.content = `_ctx.${node.content.content}`;
  }
}
function traverseNode(node, context) {
  context.currentNode = node;
  const { nodeTransforms } = context;
  const exitFns = [];
  for (let i2 = 0; i2 < nodeTransforms.length; i2++) {
    const onExit = nodeTransforms[i2](node, context);
    if (onExit) {
      if (isArray(onExit)) {
        exitFns.push(...onExit);
      } else {
        exitFns.push(onExit);
      }
    }
    if (!context.currentNode) {
      return;
    } else {
      node = context.currentNode;
    }
  }
  switch (node.type) {
    case 5 /* INTERPOLATION */:
      context.helper(TO_DISPLAY_STRING);
      break;
    case 1 /* ELEMENT */:
    case 0 /* ROOT */:
      traverseChildren(node, context);
      break;
  }
  context.currentNode = node;
  let i = exitFns.length;
  while (i--) {
    exitFns[i]();
  }
}
function traverseChildren(parent, context) {
  var _a;
  let i = 0;
  const nodeRemoved = () => {
    i--;
  };
  for (; i < ((_a = parent.children) == null ? void 0 : _a.length); i++) {
    const child = parent.children[i];
    if (isString(child))
      continue;
    context.parent = parent;
    context.childIndex = i;
    context.onNodeRemoved = nodeRemoved;
    traverseNode(child, context);
  }
}

// packages/compiler-core/src/compile.ts
function baseCompile(template) {
  const ast = baseParse(template);
  transform(ast);
  return generate(ast);
}
export {
  baseCompile as compile
};
//# sourceMappingURL=index.js.map
