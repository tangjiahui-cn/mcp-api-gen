import { parse } from "@babel/parser";
import * as t from "@babel/types";
import { createError } from "@/share";
import generateModule from "@babel/generator";
// @ts-ignore
const generate: typeof generateModule.default = generateModule.default;

/**
 * API 示例代码解析结果
 */
export type BaseExampleParseResult = {
  /** 所有 import 语句 */
  imports: string;
  /** API 函数之前的顶层代码（不包含 import） */
  prelude: string;
  /** 用于生成的 API 函数实例 */
  apiExample: string;
};

/**
 * API 示例解析
 *
 * @param example API 示例代码
 * @returns 拆分后的代码结构
 */
export function baseExampleParser(example?: string): BaseExampleParseResult {
  if (!example || !example?.trim()) {
    return {
      imports: "",
      prelude: "",
      apiExample: "",
    };
  }
  try {
    return astParser(example);
  } catch (err) {
    // 只允许语法错误兜底解析
    if (isSyntaxError(err)) {
      return stringParser(example);
    }

    throw err;
  }
}

function isSyntaxError(err: any) {
  return (
    err?.name === "SyntaxError" ||
    err?.message?.includes("Unexpected") ||
    err?.message?.includes("Parsing error")
  );
}

/**
 * 基于 ATS 规则解析 API 示例（确保准确）
 *
 * @param example API 示例代码
 * @returns 拆分后的代码结构
 */
function astParser(example: string): BaseExampleParseResult {
  const ast = parse(example, {
    sourceType: "module",
    plugins: ["typescript"],
    errorRecovery: false, // 解析失败直接抛错
  });

  const importNodes: t.ImportDeclaration[] = [];
  const preludeNodes: t.Statement[] = [];

  // export function 节点
  const apiNodes: t.ExportNamedDeclaration[] = [];
  let foundApi = false;

  // 只看顶层
  for (const node of ast.program.body) {
    // import
    if (t.isImportDeclaration(node)) {
      node.trailingComments = undefined;
      importNodes.push(node);
      continue;
    }

    // 不支持 export default
    if (t.isExportDefaultDeclaration(node)) {
      throw createError(
        "不支持 export default，请使用 export async function",
        "astParser",
      );
    }

    // export
    if (t.isExportNamedDeclaration(node)) {
      const decl = node.declaration;

      // 不支持 export { fn }
      if (node.specifiers?.length) {
        throw createError(
          "不支持 export { fn } 写法，请使用 export function",
          "astParser",
        );
      }

      // 不支持函数表达式 / 箭头函数
      if (decl && t.isVariableDeclaration(decl)) {
        throw createError(
          "不支持箭头函数或函数表达式，请使用 export function",
          "astParser",
        );
      }

      // 只允许 export function
      if (decl && t.isFunctionDeclaration(decl)) {
        apiNodes.push(node);
        foundApi = true;
        continue;
      }

      // 其他 export 不处理
      if (decl) {
        throw createError("仅支持 export function 写法", "astParser");
      }
    }

    // API 之前的代码
    if (!foundApi) {
      preludeNodes.push(node as t.Statement);
    }
  }

  if (apiNodes.length === 0) {
    throw createError("未找到 export function 作为 API 示例", "astParser");
  }

  if (apiNodes.length > 1) {
    throw createError(
      "只支持一个 API 函数，请仅保留一个 export function 作为示例",
      "astParser",
    );
  }

  const apiExampleNode: t.ExportNamedDeclaration = apiNodes[0];

  return {
    imports: importNodes.map((n) => generate(n).code).join("\n"),
    prelude: preludeNodes.map((n) => generate(n).code).join("\n"),
    apiExample: generate(apiExampleNode).code,
  };
}

/**
 * 基于字符串规则解析 API 示例（兜底解析）
 *
 * @param example API 示例代码
 */
function stringParser(example: string): BaseExampleParseResult {
  const lines = example.split("\n");

  const importLines: string[] = [];
  const preludeLines: string[] = [];
  const apiExampleLines: string[] = [];

  // 是否进入 API 定义
  let seenApi = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // API 之前的 import
    if (!seenApi && line.trim().startsWith("import ")) {
      importLines.push(line);
      continue;
    }

    // api起点，匹配到 export function
    if (!seenApi && /^\s*export\s+(async\s+)?function/.test(line)) {
      seenApi = true;
    }

    // API 代码
    if (seenApi) {
      apiExampleLines.push(line);
      continue;
    }

    // 其他顶层代码
    preludeLines.push(line);
  }

  // 必须有 API
  if (!apiExampleLines.length) {
    throw createError("未找到 export function 作为 API 示例", "stringParser");
  }

  return {
    imports: importLines.join("\n"),
    prelude: preludeLines.join("\n").trim(),
    apiExample: apiExampleLines.join("\n").trim(),
  };
}
