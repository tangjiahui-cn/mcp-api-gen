import { CreateApiInput, CreateApiResolvedInput } from "./schema";
import { HttpMethod } from "@/types";
import { parse } from "@babel/parser";
import * as t from "@babel/types";
import traverseModule from "@babel/traverse";
import generateModule from "@babel/generator";
import { createError } from "@/share";
// @ts-ignore
const traverse: typeof traverseModule.default = (traverseModule as any).default;
// @ts-ignore
const generate: typeof generateModule.default = generateModule.default;

/**
 * 获取格式化字符串
 */
function getString(value?: string): string | undefined {
  return typeof value === "string" && value?.trim() ? value?.trim() : undefined;
}

/**
 * 标准化 createApi 输入参数
 */
export function normalizeCreateApiInput(
  input: CreateApiInput,
): CreateApiResolvedInput {
  const { openapiUrl, projectRoot, output, example } = input;

  // 解析 openapiUrl（参数优先，其次环境变量）
  const url = getString(openapiUrl) || getString(process.env.OPENAPI_URL);

  if (!url) {
    throw createError("缺少 openapiUrl，请通过参数或环境变量 OPENAPI_URL 指定");
  }

  // projectRoot 校验
  if (!projectRoot?.trim()) {
    throw createError("projectRoot 必须传入（通常为当前工作区路径）");
  }

  // output 处理（允许空字符串，提供默认值）
  const finalOutput =
    typeof output === "string" && output.trim() !== ""
      ? output.trim()
      : "./api.ts";

  return {
    openapiUrl: url,
    projectRoot: projectRoot.trim(),
    output: finalOutput,
    example: example?.trim(),
  };
}

/**
 * 转义正则特殊字符
 * 用于构建安全的动态正则表达式
 */
function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 安全替换工具：
 * - 仅替换完整标识符（通过 \b 边界控制）
 * - 避免出现 target → tarpost 这类问题
 */
function replaceIdentifier(
  source: string,
  target: string,
  placeholder: string,
) {
  if (!target) return source;
  const reg = new RegExp(`\\b${escapeRegExp(target)}\\b`, "g");
  return source.replace(reg, placeholder);
}

/**
 * 标准化 HTTP 方法
 */
export function normalizeMethod(method: string): HttpMethod | null {
  const m = method.toLowerCase();
  return ["get", "post", "put", "delete", "patch"].includes(m)
    ? (m as HttpMethod)
    : null;
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
export function normalizeExampleByAst(example: string): string {
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
