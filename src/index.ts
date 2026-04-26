#!/usr/bin/env node
/**
 * mcp-api-gen
 *
 * 基于 MCP 的 API 生成服务，
 * 用于将 OpenAPI / Swagger 文档生成前端 TypeScript 接口代码。
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import prettier from "prettier";

/**
 * 单个 API 方法模板
 */
const DEFAULT_API_TEMPLATE = ({
  summary,
  name,
  paramsType,
  returnType,
  request,
  hasParams,
}: {
  summary?: string;
  name: string;
  paramsType: string;
  returnType: string;
  request: string;
  hasParams: boolean | string;
}) => `
/**
 * ${summary || name}
 */
export function ${name}(
  ${hasParams ? paramsType : ""}
): Promise<${returnType}> {
  return ${request};
}
`;

/**
 * 文件模板
 */
const DEFAULT_FILE_TEMPLATE = (code: string) => `import axios from 'axios';
${code}
`;

/**
 * 支持的 HTTP 方法
 */
type HttpMethod = "get" | "post" | "put" | "delete" | "patch";

/**
 * Schema 节点定义（用于描述请求/响应的数据结构）
 */
type SchemaObject = {
  /** 当前节点的数据类型（string / number / object / array 等） */
  type?: string;

  /** 字段描述（通常来自接口文档，用于生成注释） */
  description?: string;

  /** 对象类型的属性集合（key -> 子 Schema） */
  properties?: Record<string, SchemaObject>;

  /** 数组元素的类型定义（当 type 为 array 时生效） */
  items?: SchemaObject;

  /** 必填字段列表（用于区分可选/必选） */
  required?: string[];

  /** 引用其他 Schema（如 #/components/schemas/User） */
  $ref?: string;
};

/**
 * OpenAPI 文档结构（兼容 Swagger2 / OpenAPI3）
 */
type OpenAPISpec = {
  /**
   * 接口路径定义
   * key: /api/user/list
   * value: { get: {...}, post: {...} }
   */
  paths?: Record<string, Record<string, any>>;

  /** Swagger2 的模型定义（旧版本字段） */
  definitions?: Record<string, SchemaObject>;

  /** OpenAPI3 的组件定义（推荐使用） */
  components?: {
    /** schema 模型定义集合 */
    schemas?: Record<string, SchemaObject>;
  };
};

/**
 * OpenAPI 单个接口方法定义
 *
 * 对应结构：
 * spec.paths['/api/user/list']['get'] -> OpenApiOperationObject
 */
type OpenApiOperationObject = {
  /** 接口摘要，用于生成函数注释 */
  summary?: string;

  /** OpenAPI3 请求体定义 */
  requestBody?: {
    /** 不同 content-type 下的请求体结构 */
    content?: {
      [contentType: string]: {
        /** 请求体 schema */
        schema?: SchemaObject;
      };
    };
  };

  /** Swagger2 / OpenAPI 通用参数定义 */
  parameters?: Array<{
    /** 参数名称 */
    name: string;

    /** 参数位置：query / path / body / header */
    in: "query" | "path" | "body" | "header";

    /** 是否必填 */
    required?: boolean;

    /** Swagger2 参数类型 */
    type?: string;

    /** 参数 schema，常用于 body 参数或 OpenAPI3 参数 */
    schema?: SchemaObject;
  }>;

  /** 标准 responses 定义 */
  responses?: Record<
    string,
    {
      /** Swagger2 响应 schema */
      schema?: SchemaObject;

      /** OpenAPI3 响应内容定义 */
      content?: {
        [contentType: string]: {
          /** 响应体 schema */
          schema?: SchemaObject;
        };
      };
    }
  >;

  /** 兼容部分文档工具生成的 responsesObject 字段 */
  responsesObject?: Record<
    string,
    {
      /** Swagger2 响应 schema */
      schema?: SchemaObject;

      /** OpenAPI3 响应内容定义 */
      content?: {
        [contentType: string]: {
          /** 响应体 schema */
          schema?: SchemaObject;
        };
      };
    }
  >;
};

/**
 * MCP 服务实例
 */
const server = new McpServer({
  name: "openapi-to-api",
  version: "0.1.0",
});

/**
 * 生成统计信息
 */
let totalCount = 0;
let typedCount = 0;
const missingSchemas: string[] = [];

/**
 * 拉取 OpenAPI 文档
 */
async function fetchSpec(url: string): Promise<OpenAPISpec> {
  const res = await fetch(url);

  if (!res.ok) {
    let detail = "";

    try {
      // 尝试读取返回内容（有些后端会返回错误信息）
      detail = await res.text();
    } catch {}

    throw new Error(
      `[mcp-api-gen] fetch OpenAPI failed: ${res.status} ${res.statusText}${
        detail ? `\n${detail}` : ""
      }`,
    );
  }

  return (await res.json()) as OpenAPISpec;
}

/**
 * 标准化 HTTP 方法
 */
function normalizeMethod(method: string): HttpMethod | null {
  const m = method.toLowerCase();
  return ["get", "post", "put", "delete", "patch"].includes(m)
    ? (m as HttpMethod)
    : null;
}

/**
 * 拆分字符串为单词数组（用于命名处理）
 *
 * 示例：
 * '/api/user/list'   -> ['api', 'user', 'list']
 * 'userName'         -> ['user', 'Name']
 * 'dept_push_config' -> ['dept', 'push', 'config']
 * 'getUserById'      -> ['get', 'User', 'By', 'Id']
 * 'order-detail'     -> ['order', 'detail']
 */
function splitWords(input: string): string[] {
  return input
    .replace(/[^a-zA-Z0-9]/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * 转换为驼峰命名（camelCase / PascalCase）
 *
 * 示例：
 * 'id'               -> 'id'
 * 'id'               -> 'Id'            (isFirst = false)
 * 'user-name'        -> 'userName'
 * 'user-name'        -> 'UserName'      (isFirst = false)
 * 'get_user_by_id'   -> 'getUserById'
 * 'getUserById'      -> 'getUserById'
 * 'user_id'          -> 'userId'
 * 'user_id'          -> 'UserId'        (isFirst = false)
 * '/api/user/list'   -> 'apiUserList'
 */
function toCamelCase(input: string, isFirst: boolean): string {
  const words = splitWords(input);

  return words
    .map((word, index) => {
      const lower = word.toLowerCase();

      if (lower === "id") {
        return isFirst && index === 0 ? "id" : "Id";
      }

      if (isFirst && index === 0) return lower;

      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

/**
 * 根据接口路径生成函数名
 *
 * 示例：
 * '/api/user/list'                -> 'userList'
 * '/api/user/detail/{id}'         -> 'userDetailById'
 * '/api/dept/push/config/list'    -> 'pushConfigList'
 * '/api/user/delete' (delete)     -> 'deleteUserDelete'   // 避免关键字冲突
 * '/api/export' (post)            -> 'postExport'         // 避免关键字冲突
 */
function generateName(method: string, apiPath: string) {
  // 将 {id} 转为 ById，避免函数名语义丢失
  let segments = apiPath
    .replace(/\{(\w+)\}/g, "By_$1")
    .split("/")
    .filter(Boolean)
    // 去掉通用前缀 api
    .filter((s) => s.toLowerCase() !== "api");

  // 控制函数名长度，仅取末尾 3 段
  segments = segments.slice(-3);

  // 转驼峰
  let name = segments.map((s, i) => toCamelCase(s, i === 0)).join("");

  // 避免 JS 关键字冲突
  const reserved = new Set([
    "delete",
    "export",
    "import",
    "default",
    "function",
    "class",
  ]);

  if (!name || reserved.has(name)) {
    name = method + name.charAt(0).toUpperCase() + name.slice(1);
  }

  return name;
}

/**
 * 解析 $ref 引用（递归展开为真实 Schema）
 *
 * 示例：
 * { $ref: '#/components/schemas/User' } -> { type: 'object', properties: { name: { type: 'string' } } }
 * { $ref: '#/definitions/Order' } -> { type: 'object', properties: { id: { type: 'number' } } }
 * 普通 Schema（无 $ref）-> 原样返回
 */
function resolveSchema(
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
function getRefKey(schema: SchemaObject | undefined) {
  if (!schema?.$ref) return "";
  return schema.$ref
    .replace("#/components/schemas/", "")
    .replace("#/definitions/", "");
}

/**
 * Schema 转 TS 类型
 */
function toTsType(
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

  if (["integer", "number"].includes(resolved.type || "")) return "number";
  if (resolved.type === "boolean") return "boolean";
  if (resolved.type === "string") return "string";

  return "any";
}

/**
 * 获取 requestBody schema
 */
function getRequestBodySchema(op: OpenApiOperationObject) {
  return op?.requestBody?.content?.["application/json"]?.schema;
}

/**
 * 获取响应 schema
 */
function getResponseSchema(op: OpenApiOperationObject) {
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
 * 生成返回类型
 */
function generateReturnType(op: OpenApiOperationObject, spec: OpenAPISpec) {
  const responseSchema = getResponseSchema(op);

  if (!responseSchema) {
    return "any";
  }

  const tsType = toTsType(responseSchema, spec);

  // 空对象降级
  if (tsType === "{}" || tsType === "{\n\n  }") {
    return "any";
  }

  return tsType;
}

/**
 * 生成接口参数类型（params）
 *
 * 示例：
 * 1. OpenAPI3（requestBody）
 * op.requestBody.content['application/json'].schema
 * -> params: { name: string; age?: number }
 *
 * 2. Swagger2（body 参数）
 * op.parameters 中 in = 'body'
 * -> params: { id: number }
 *
 * 3. 普通 query / path 参数
 * op.parameters = [
 *   { name: 'id', type: 'number', required: true },
 *   { name: 'name', type: 'string' }
 * ]
 * -> params: { id: number; name?: string }
 *
 * 4. 无参数
 * -> ''（函数不生成 params）
 */
function generateParamsType(
  op: OpenApiOperationObject,
  spec: OpenAPISpec,
  apiPath: string,
) {
  totalCount++;

  const markMissing = () => {
    missingSchemas.push(apiPath);
    return `params: Record<string, any> // schema 未定义`;
  };

  // OpenAPI3
  const bodySchema = getRequestBodySchema(op);
  if (bodySchema) {
    const tsType = toTsType(bodySchema, spec);
    if (tsType === "any") return markMissing();

    typedCount++;
    return `params: ${tsType}`;
  }

  // Swagger2
  const body = op.parameters?.find((p: any) => p.in === "body");
  if (body?.schema) {
    const tsType = toTsType(body.schema, spec);
    if (tsType === "any") return markMissing();

    typedCount++;
    return `params: ${tsType}`;
  }

  const params = op.parameters || [];

  if (!params.length) {
    return "";
  }

  const typeMap: Record<string, string> = {
    string: "string",
    integer: "number",
    number: "number",
    boolean: "boolean",
  };

  const lines = params.map((p: any) => {
    const optional = p.required ? "" : "?";
    const type = p.schema ? toTsType(p.schema, spec) : typeMap[p.type] || "any";

    return `    ${p.name}${optional}: ${type};`;
  });

  typedCount++;
  return `params: {\n${lines.join("\n")}\n  }`;
}

/**
 * 生成单个 API 方法
 */
function generateApi(
  method: string,
  apiPath: string,
  op: OpenApiOperationObject,
  spec: OpenAPISpec,
) {
  const name = generateName(method, apiPath);
  const paramsType = generateParamsType(op, spec, apiPath);
  const returnType = generateReturnType(op, spec);

  const hasParams = paramsType && paramsType.trim();

  // 处理路径参数
  const url = apiPath.includes("{")
    ? "`" + apiPath.replace(/\{(\w+)\}/g, "${params.$1}") + "`"
    : `'${apiPath}'`;

  // GET 用 params，其它用 data
  const request = !hasParams
    ? `axios.${method}(${url})`
    : method === "get"
      ? `axios.get(${url}, { params })`
      : `axios.${method}(${url}, { data: params })`;

  return DEFAULT_API_TEMPLATE({
    summary: op.summary,
    name,
    paramsType,
    returnType,
    request,
    hasParams,
  });
}

/**
 * 生成全部 API
 */
function generateCode(spec: OpenAPISpec) {
  const result: string[] = [];

  totalCount = 0;
  typedCount = 0;
  missingSchemas.length = 0;

  for (const [apiPath, methods] of Object.entries(spec.paths || {})) {
    for (const [method, op] of Object.entries(methods || {})) {
      const m = normalizeMethod(method);
      if (!m) continue;

      result.push(generateApi(m, apiPath, op, spec));
    }
  }

  return result.join("\n");
}

/**
 * MCP 工具：生成 API 文件
 */
server.registerTool(
  "createAPI",
  {
    description: "根据 OpenAPI/Swagger 地址自动生成前端 API 调用代码",
    inputSchema: {
      openapiUrl: z
        .string()
        .url()
        .optional()
        .describe(
          "Swagger/OpenAPI 文档地址（优先，其次使用环境变量 OPENAPI_URL）",
        ),
      projectRoot: z
        .string()
        .optional()
        .describe("当前项目根目录（必须传入，通常为当前工作区路径）"),
      output: z
        .string()
        .describe(
          '生成文件路径（必须传入）。例如：./api.ts 或 ./src/api.ts；以 / 开头表示绝对路径；如不指定请传空字符串 ""',
        ),
    },
  },
  async ({ openapiUrl, projectRoot, output }) => {
    const url = openapiUrl?.trim() || process.env.OPENAPI_URL?.trim();

    if (!url) {
      throw new Error(
        "[mcp-api-gen] openapiUrl is required，请通过参数或 OPENAPI_URL 环境变量指定文档地址",
      );
    }

    const spec = await fetchSpec(url);
    const code = generateCode(spec);

    let finalCode = DEFAULT_FILE_TEMPLATE(code);

    // 格式化代码
    try {
      finalCode = await prettier.format(finalCode, {
        parser: "typescript",
        semi: true,
        singleQuote: true,
        trailingComma: "all",
      });
    } catch (err) {
      console.warn("prettier format failed:", err);
    }

    const root = projectRoot || process.cwd();

    // 防止误写入 home 目录
    const resolvedRoot = path.resolve(root);
    if (resolvedRoot === "/" || resolvedRoot === process.env.HOME) {
      throw new Error("[mcp-api-gen] invalid projectRoot，禁止写入系统目录");
    }

    const outputFile = output || "./api.ts";

    // 绝对路径（以 / 开头）
    const outputPath = outputFile.startsWith("/")
      ? outputFile
      : path.resolve(resolvedRoot, outputFile);

    if (!outputPath.startsWith(resolvedRoot)) {
      throw new Error("[mcp-api-gen] output must be inside projectRoot");
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, finalCode, "utf-8");

    // 统计缺失 schema
    const uniqueMissing = Array.from(new Set(missingSchemas));
    const missingCount = uniqueMissing.length;
    const percent = totalCount
      ? Math.round((missingCount / totalCount) * 100)
      : 0;

    return {
      content: [
        {
          type: "text",
          text: `[MCP执行完成]

前端 API 文件已生成，请勿重复生成代码。

生成文件位置：
${outputPath}

接口统计：
- 总计生成 API 数量：${totalCount}
- 已生成类型接口数：${typedCount}
- 缺失 schema 接口数：${missingCount} (${percent}%)`,
        },
      ],
    };
  },
);

/**
 * 启动 MCP 服务
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
