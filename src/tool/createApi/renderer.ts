import { ApiInfo, ApiInfoKey } from "@/schema";

/**
 * API 渲染函数
 */
export type ApiRenderType = (apiInfo: Partial<ApiInfo>) => string;

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

/** fallback 映射 */
const FALLBACK: Partial<Record<ApiInfoKey, string>> = {
  summary: "",
  responseType: "any",
  requestType: "any",
};

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

/** 格式化变量值 */
function formatValue(key: ApiInfoKey, value: unknown): string {
  if (value === undefined || value === null) {
    return FALLBACK[key] ?? "";
  }
  return String(value);
}

/**
 * 创建 API 渲染器
 * @param template 模板字符串（包含 {{key}}）
 */
export function createApiRender(template: string): ApiRenderType {
  if (!template.includes("{{")) {
    return () => template;
  }

  // 预编译模板（避免多次重复正则替换）
  const tokens = compile(template);

  return function render(apiInfo: Partial<ApiInfo>): string {
    let output = "";

    for (const token of tokens) {
      if (token.type === "text") {
        output += token.value;
      } else {
        const value = apiInfo[token.key];
        output += formatValue(token.key, value);
      }
    }

    return output;
  };
}
