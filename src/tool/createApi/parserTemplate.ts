import { parse } from "@babel/parser";
import * as t from "@babel/types";
import { createError } from "@/share";
import traverseModule from "@babel/traverse";
import generateModule from "@babel/generator";
// @ts-ignore
const traverse: typeof traverseModule.default = (traverseModule as any).default;
// @ts-ignore
const generate: typeof generateModule.default = generateModule.default;

export const DEFAULT_IMPORTS = 'import axios from "axios"';
export const DEFAULT_TEMPLATE = `
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
 * 创建 API 生成模板
 * @param example api 请求实例
 */
export function createTemplate(example?: string): string {
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
              arg.arguments[0] = replaceUrlTemplate(
                arg.arguments[0] as t.Expression,
              );
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
 * 将示例中 url 替换成模板
 * @description 例如：`${prefix}/api/user` -> `${prefix}{{url}}`
 */
function replaceUrlTemplate(node: t.Expression): t.Expression {
  // '/api/user'
  if (t.isStringLiteral(node)) {
    return createUrlTemplate();
  }

  // `${prefix}/api/user`
  if (t.isTemplateLiteral(node)) {
    const firstExpr = node.expressions[0];
    const firstQuasi = node.quasis[0];

    const hasPrefixExpression = firstExpr && firstQuasi?.value.raw === "";

    if (hasPrefixExpression) {
      return createUrlTemplate(firstExpr as t.Expression);
    }

    // `/user/${id}`
    return createUrlTemplate();
  }

  // fallback
  return createUrlTemplate();
}

/**
 * 创建 URL 模板的 AST 节点
 * @description 例如：生成 `{{url}}` 或 `${prefix}{{url}}` 的 AST 节点
 */
function createUrlTemplate(prefix?: t.Expression): t.TemplateLiteral {
  return t.templateLiteral(
    prefix
      ? [
          t.templateElement({
            raw: "",
            cooked: "",
          }),
          t.templateElement({
            raw: "{{url}}",
            cooked: "{{url}}",
          }),
        ]
      : [
          t.templateElement({
            raw: "{{url}}",
            cooked: "{{url}}",
          }),
        ],
    prefix ? [prefix] : [],
  );
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
