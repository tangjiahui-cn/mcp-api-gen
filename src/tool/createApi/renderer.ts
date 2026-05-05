import { ApiInfoKey } from "@/schema";

/** 静态文本片段 */
type TextToken = {
  type: "text";
  value: string;
};

/** 模板变量 */
type VarToken = {
  type: "var";
  key: ApiInfoKey;
};

/** 模板 token */
type Token = TextToken | VarToken;

/** 编译模板为 tokens */
function compile(template: string): Token[] {
  const tokens: Token[] = [];
  const reg = /\{\{(\w+)\}\}/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = reg.exec(template))) {
    const [_, key] = match;

    // text
    if (match.index > lastIndex) {
      tokens.push({
        type: "text",
        value: template.slice(lastIndex, match.index),
      });
    }

    // var
    tokens.push({
      type: "var",
      key: key as ApiInfoKey,
    });

    lastIndex = reg.lastIndex;
  }

  // 剩余文本
  if (lastIndex < template.length) {
    tokens.push({
      type: "text",
      value: template.slice(lastIndex),
    });
  }

  return tokens;
}

/**
 * 创建模板渲染器
 * @param template 模板字符串（包含 {{key}}）
 */
type TemplateRender = (data: Record<string, any>) => string;
export function createTemplateRender(template: string): TemplateRender {
  if (!template.includes("{{")) {
    return () => template;
  }

  // 预编译模板（避免多次重复正则替换）
  const tokens = compile(template);

  return function render(data: Record<string, any>) {
    let output = "";

    for (const token of tokens) {
      if (token.type === "text") {
        output += token.value;
      } else {
        output += data[token.key] ?? "";
      }
    }

    return output;
  };
}
