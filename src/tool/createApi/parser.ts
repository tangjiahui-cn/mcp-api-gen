import {
  ExampleParser,
  OpenApiOperationObject,
  OpenAPISpec,
  SchemaObject,
} from "@/schema";
import traverseModule from "@babel/traverse";
import generateModule from "@babel/generator";
import { createError } from "@/share";
import { parse } from "@babel/parser";
import * as t from "@babel/types";
// @ts-ignore
const traverse: typeof traverseModule.default = (traverseModule as any).default;
// @ts-ignore
const generate: typeof generateModule.default = generateModule.default;

/** ================= schema ================= */
/**
 * Schema 转 TS 类型
 */
export function toTsType(
  schema: SchemaObject | undefined,
  spec: OpenAPISpec,
  visited = new Set<string>(),
): string {
  // 防止循环引用导致死递归
  const refKey = getRefKey(schema);
  if (refKey) {
    if (visited.has(refKey)) return "any";
    visited.add(refKey);
  }

  const resolved = resolveSchema(schema, spec);
  if (!resolved) return "any";

  // 数组类型递归处理
  if (resolved.type === "array") {
    return `${toTsType(resolved.items, spec, new Set(visited))}[]`;
  }

  // 对象类型展开
  if (resolved.type === "object" || resolved.properties) {
    const props = resolved.properties || {};
    const required = new Set(resolved.required || []);

    const lines = Object.entries(props).map(([key, val]) => {
      const optional = required.has(key) ? "" : "?";
      const comment = val.description ? `    /** ${val.description} */\n` : "";

      return `${comment}    ${key}${optional}: ${toTsType(
        val,
        spec,
        new Set(visited),
      )};`;
    });

    return `{\n${lines.join("\n")}\n  }`;
  }

  if (resolved.enum) {
    return resolved.enum
      .map((v) => {
        if (typeof v === "string") return JSON.stringify(v);
        if (typeof v === "number") return String(v);
        if (typeof v === "boolean") return String(v);
        if (v === null) return "null";
        return "any";
      })
      .join(" | ");
  }

  if (["integer", "number"].includes(resolved.type || "")) return "number";
  if (resolved.type === "boolean") return "boolean";
  if (resolved.type === "string") return "string";

  return "any";
}

/**
 * 获取 requestBody schema
 */
export function getRequestBodySchema(op: OpenApiOperationObject) {
  return op?.requestBody?.content?.["application/json"]?.schema;
}

/**
 * 获取响应 schema
 */
export function getResponseSchema(op: OpenApiOperationObject) {
  const response =
    op?.responses?.["200"] ||
    op?.responses?.[200] ||
    op?.responsesObject?.["200"] ||
    op?.responsesObject?.[200];

  if (!response) return undefined;

  return (
    response.schema ||
    response.content?.["application/json"]?.schema ||
    response.content?.["*/*"]?.schema ||
    response.content?.["application/octet-stream"]?.schema
  );
}

/**
 * 解析 $ref 引用（递归展开为真实 Schema）
 *
 * 示例：
 * { $ref: '#/components/schemas/User' } -> { type: 'object', properties: { name: { type: 'string' } } }
 * { $ref: '#/definitions/Order' } -> { type: 'object', properties: { id: { type: 'number' } } }
 * 普通 Schema（无 $ref）-> 原样返回
 */
export function resolveSchema(
  schema: SchemaObject | undefined,
  spec: OpenAPISpec,
): SchemaObject | undefined {
  if (!schema) return undefined;

  if (schema.$ref) {
    const ref = schema.$ref;

    // OpenAPI3
    if (ref.startsWith("#/components/schemas/")) {
      const key = ref.replace("#/components/schemas/", "");
      return resolveSchema(spec.components?.schemas?.[key], spec);
    }

    // Swagger2
    if (ref.startsWith("#/definitions/")) {
      const key = ref.replace("#/definitions/", "");
      return resolveSchema(spec.definitions?.[key], spec);
    }
  }

  return schema;
}

/**
 * 获取 ref key（用于循环引用检测）
 */
export function getRefKey(schema: SchemaObject | undefined): string {
  if (!schema?.$ref) return "";
  return schema.$ref
    .replace("#/components/schemas/", "")
    .replace("#/definitions/", "");
}

/** ================= example parser ================= */

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
function baseExampleParser(example?: string): BaseExampleParseResult {
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
    // 只允许语法错误 fallback
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

  // 收集所有导出的函数节点
  const apiNodes: t.ExportNamedDeclaration[] = [];
  let foundApi = false;

  // 只遍历顶层
  for (const node of ast.program.body) {
    // import
    if (t.isImportDeclaration(node)) {
      // 清理注释
      node.trailingComments = undefined;
      importNodes.push(node);
      continue;
    }

    // 拦截 default export
    if (t.isExportDefaultDeclaration(node)) {
      throw createError(
        "不支持 export default，请使用 export async function",
        "astParser",
      );
    }

    // API 函数
    if (t.isExportNamedDeclaration(node)) {
      const decl = node.declaration;

      // 拦截函数变量导出 （例如：export { fn }）
      if (node.specifiers?.length) {
        throw createError(
          "不支持 export { fn } 写法，请使用 export function",
          "astParser",
        );
      }

      // 拦截箭头函数
      if (decl && t.isVariableDeclaration(decl)) {
        throw createError(
          "不支持箭头函数或函数表达式，请使用 export function",
          "astParser",
        );
      }

      // 只允许普通函数
      if (decl && t.isFunctionDeclaration(decl)) {
        apiNodes.push(node);
        foundApi = true;
        continue;
      }

      // 不支持其他写法
      if (decl) {
        throw createError("仅支持 export function 写法", "astParser");
      }
    }

    // API 之前的顶层代码
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

  // 标记进入 API 定义区域
  let seenApi = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // import 语句（仅在 API 定义之前收集）
    if (!seenApi && line.trim().startsWith("import ")) {
      importLines.push(line);
      continue;
    }

    // API 起点识别（同时包含 export 与 function）
    if (!seenApi && /^\s*export\s+(async\s+)?function/.test(line)) {
      seenApi = true;
    }

    // API 区域起点及之后的内容全部归入 template
    if (seenApi) {
      apiExampleLines.push(line);
      continue;
    }

    // API 之前的其他顶层代码归入 prelude
    preludeLines.push(line);
  }

  // 必须存在 API 示例
  if (!apiExampleLines.length) {
    throw createError("未找到 export function 作为 API 示例", "stringParser");
  }

  return {
    imports: importLines.join("\n"),
    prelude: preludeLines.join("\n").trim(),
    apiExample: apiExampleLines.join("\n").trim(),
  };
}

/** ================= template ================= */

/**
 * 创建 API 生成模板
 * @param example api 请求实例
 */
function createTemplate(example?: string): string {
  if (example && example?.trim()) {
    return createTemplateFromExample(example);
  }

  // 默认模板
  return DEFAULT_TEMPLATE;
}

/**
 * 将 API 示例代码转换为模板字符串（基于 AST）
 *
 * - 函数名 -> {{name}}
 * - 请求方法 -> {{method}}
 * - 请求地址 -> {{url}}
 * - 入参变量 -> {{paramsName}}
 * - 参数承载方式 -> {{paramsType}}
 * - 入参类型 -> {{requestType}}
 * - 返回类型 -> {{responseType}}
 * - 函数注释 -> {{summary}}
 *
 * 调用方式示例：
 * - request.get / axios.post / client.http.put
 * - fetch(url, options)
 * - 自定义函数调用（callApi / http 等）
 */
export function createTemplateFromExample(example: string): string {
  try {
    const ast = parse(example, {
      sourceType: "module",
      plugins: ["typescript"],
    });

    let hasFunction = false;
    let hasRequestCall = false;

    // 注释类型
    let commentType: "block" | "line" = "line";

    traverse(ast, {
      FunctionDeclaration(path: any) {
        hasFunction = true;

        const parent = path.parentPath;
        let commentNode: any = path.node;

        if (parent.isExportNamedDeclaration()) {
          commentNode = parent.node;
        }

        // 读取注释类型
        if (commentNode.leadingComments?.length) {
          const first = commentNode.leadingComments[0];
          if (first.type === "CommentBlock") {
            commentType = "block";
          } else {
            commentType = "line";
          }
        }

        // 清除原注释
        commentNode.leadingComments = undefined;

        // 函数名
        if (path.node.id) {
          path.node.id.name = "{{name}}";
        }

        // 参数
        const param = path.node.params[0];
        if (t.isIdentifier(param)) {
          param.name = "{{paramsName}}";
          param.typeAnnotation = t.tsTypeAnnotation(
            t.tsTypeReference(t.identifier("{{requestType}}")),
          );
        }

        // 返回类型占位
        path.node.returnType = t.tsTypeAnnotation(
          t.tsTypeReference(
            t.identifier("Promise"),
            t.tsTypeParameterInstantiation([
              t.tsTypeReference(t.identifier("{{responseType}}")),
            ]),
          ),
        );

        path.traverse({
          ReturnStatement(returnPath: any) {
            const arg = returnPath.node.argument;
            if (!t.isCallExpression(arg)) return;

            const info = getRequestCallInfo(arg);
            if (!info) return;

            hasRequestCall = true;

            // method
            if (info.type === "member" && t.isMemberExpression(arg.callee)) {
              if (t.isIdentifier(arg.callee.property)) {
                arg.callee.property.name = "{{method}}";
              } else if (t.isStringLiteral(arg.callee.property)) {
                arg.callee.property.value = "{{method}}";
              }
            }

            // url
            if (arg.arguments.length > 0) {
              arg.arguments[0] = t.identifier("__URL__");
            }

            // 参数承载
            const secondArg = arg.arguments[1];

            if (t.isObjectExpression(secondArg)) {
              secondArg.properties.forEach((p) => {
                if (
                  t.isObjectProperty(p) &&
                  t.isIdentifier(p.key) &&
                  ["params", "data", "body"].includes(p.key.name)
                ) {
                  p.key.name = "{{paramsType}}";

                  if (t.isIdentifier(p.value)) {
                    p.value.name = "{{paramsName}}";
                  }
                }
              });
            }
          },
        });
      },
    });

    if (!hasFunction) {
      throw createError("未找到函数声明", "normalizeExampleByAst");
    }

    if (!hasRequestCall) {
      throw createError("未识别到请求调用", "normalizeExampleByAst");
    }

    let code = generate(ast, {
      comments: false,
    }).code;

    // 替换 url
    code = code.replaceAll("__URL__", "`{{url}}`");

    // 保持原有 summary 行为
    if ((commentType as any) === "block") {
      code = `/**\n * {{summary}}\n */\n${code}`;
    } else {
      code = `// {{summary}}\n${code}`;
    }

    return code;
  } catch (err: any) {
    throw createError(
      `${err?.message || "unknown error"}`,
      "normalizeExampleByAst",
    );
  }
}

/**
 * 识别请求调用类型
 */
function getRequestCallInfo(node: t.CallExpression): {
  type: "member" | "call" | "fetch";
  method: string;
} | null {
  const callee = node.callee;

  // 成员调用（对象.方法）
  if (t.isMemberExpression(callee)) {
    const prop = callee.property;

    if (t.isIdentifier(prop)) {
      return {
        type: "member",
        method: prop.name.toLowerCase(),
      };
    }

    if (t.isStringLiteral(prop)) {
      return {
        type: "member",
        method: prop.value.toLowerCase(),
      };
    }
  }

  // fetch 调用（通过配置对象提取 method）
  if (t.isIdentifier(callee) && callee.name === "fetch") {
    let method = "get";

    const secondArg = node.arguments[1];

    if (t.isObjectExpression(secondArg)) {
      for (const prop of secondArg.properties) {
        if (
          t.isObjectProperty(prop) &&
          t.isIdentifier(prop.key) &&
          prop.key.name === "method"
        ) {
          if (t.isStringLiteral(prop.value)) {
            method = prop.value.value.toLowerCase();
          }
        }
      }
    }

    return {
      type: "fetch",
      method,
    };
  }

  // 普通函数调用（通过参数配置提取 method）
  if (t.isIdentifier(callee)) {
    let method = "get";

    const secondArg = node.arguments[1];

    if (t.isObjectExpression(secondArg)) {
      for (const prop of secondArg.properties) {
        if (
          t.isObjectProperty(prop) &&
          t.isIdentifier(prop.key) &&
          prop.key.name === "method"
        ) {
          if (t.isStringLiteral(prop.value)) {
            method = prop.value.value.toLowerCase();
          }
        }
      }
    }

    return {
      type: "call",
      method,
    };
  }

  return null;
}

/** ================= tsExampleParser ================= */

/** ========= 默认模板 ========= */
const DEFAULT_IMPORTS = 'import axios from "axios"';
const DEFAULT_TEMPLATE = `
/**
 * {{summary}}
 */
export function {{name}}(
  {{paramsName}}: {{requestType}}
): Promise<{{responseType}}> {
  return axios.{{method}}(\`{{url}}\`, {
    {{paramsType}}: {{paramsName}}
  });
}
`;

/**
 * TypeScript 实例解析器
 */
export const tsExampleParser: ExampleParser = async (example) => {
  // 解析 API 示例
  const parseResult = baseExampleParser(example);

  // 生成 API 模板
  const template = createTemplate(parseResult.apiExample);

  return {
    template,
    imports: parseResult.imports || DEFAULT_IMPORTS,
    prelude: parseResult.prelude,
  };
};
