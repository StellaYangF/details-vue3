// packages/compiler-core/src/codegen.ts
function generate(ast) {
}

// packages/compiler-core/src/parse.ts
function baseParse(content) {
  const context = createParserContext(content);
  return parseChildren(context);
}
function createParserContext(content) {
  return {
    line: 1,
    column: 1,
    offset: 0,
    source: content,
    originalSource: content
  };
}
function parseChildren(context) {
  const nodes = [];
  while (!isEnd(context)) {
    const s = context.source;
    let node;
    if (s.startsWith("{{")) {
      node = {};
    } else if (s[0] === "<") {
      node = {};
    }
    if (!node) {
      node = parseText(context);
    }
    nodes.push(node);
    break;
  }
  return nodes;
}
var isEnd = (context) => !context.source;
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
function advanceBy(context, endIndex) {
  const s = context.source;
  advancePositionWithMutation(context, s, endIndex);
  context.source = s.slice(endIndex);
}
function advancePositionWithMutation(context, s, endIndex) {
  let linesCount = 0;
  let linePos = -1;
  for (let i = 0; i < endIndex; i++) {
    if (s.charCodeAt(i) === 10) {
      linesCount++;
      linePos = i;
    }
  }
  context.offset += endIndex;
  context.line += linesCount;
  context.column = linePos === -1 ? context.column + endIndex : endIndex - linePos;
}
function getSelection(context, start) {
  const end = getCursor(context);
  return {
    start,
    end,
    source: context.originalSource.slice(start.offset, end.offset)
  };
}

// packages/compiler-core/src/transform.ts
function transform(root) {
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
