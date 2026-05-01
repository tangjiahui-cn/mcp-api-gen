#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { type ApiRenderType, createApiRender } from "./renderer";
import type { ApiInfo, OpenAPISpec, OpenApiOperationObject } from "@/schema";
import { toCamelCase, fetchJson, formatCode, createError } from "@/share";
import {
  getResponseSchema,
  toTsType,
  getRequestBodySchema,
  exampleParser,
} from "./parse";
// @ts-ignore
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/dist/esm/types";
import type { CreateApiInput } from "./schema";
import {
  normalizeCreateApiInput,
  normalizeMethod,
  normalizeExampleByAst,
} from "./normalize";
import { HttpMethod } from "@/types";

/** 判断是否为 {} */
function isEmptyObjectType(type: string): boolean {
  return !!type && type.replace(/\s/g, "") === "{}";
}

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
 * 根据接口路径生成函数名（驼峰命名、忽略 /api）
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

type GenerateResponseTypeResult = {
  code: string;
  isMissingSchema: boolean;
  isTyped: boolean;
};

/** 生成返回结果类型 */
function generateResponseType(options: {
  op: OpenApiOperationObject;
  spec: OpenAPISpec;
}): GenerateResponseTypeResult {
  const { op, spec } = options;
  const markMissing = (): GenerateResponseTypeResult => {
    return {
      code: "any",
      isTyped: false,
      isMissingSchema: true,
    };
  };

  const responseSchema = getResponseSchema(op);
  if (!responseSchema) {
    return markMissing();
  }

  const tsType = toTsType(responseSchema, spec);

  // 空对象降级为 any
  if (isEmptyObjectType(tsType)) {
    return markMissing();
  }

  return {
    code: tsType,
    isTyped: true,
    isMissingSchema: false,
  };
}

type GenerateRequestTypeResult = {
  code: string;
  isMissingSchema: boolean; // 是否类型丢失
  isTyped: boolean; // 是否类型完整
};

/** 生成请求参数类型 */
function generateRequestType(options: {
  op: OpenApiOperationObject;
  spec: OpenAPISpec;
}): GenerateRequestTypeResult {
  const { op, spec } = options;
  let isMissingSchema = false;

  const markMissing = (): GenerateRequestTypeResult => {
    isMissingSchema = true;

    return {
      code: `Record<string, any>`,
      isMissingSchema: true,
      isTyped: false,
    };
  };

  // OpenAPI3
  const bodySchema = getRequestBodySchema(op);
  if (bodySchema) {
    const tsType = toTsType(bodySchema, spec);

    if (!tsType || tsType.trim() === "any") {
      return markMissing();
    }

    return {
      code: tsType,
      isMissingSchema: false,
      isTyped: true,
    };
  }

  // Swagger2
  const body = op.parameters?.find((p: any) => p.in === "body");
  if (body?.schema) {
    const tsType = toTsType(body.schema, spec);

    if (!tsType || tsType.trim() === "any") {
      return markMissing();
    }

    return {
      code: tsType,
      isMissingSchema: false,
      isTyped: true,
    };
  }

  const params = op.parameters || [];

  if (!params.length) {
    return {
      code: "",
      isMissingSchema: false,
      isTyped: false,
    };
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

    if (type === "any") {
      isMissingSchema = true;
    }

    return `  ${p.name}${optional}: ${type};`;
  });

  return {
    code: `{\n${lines.join("\n")}\n}`,
    isMissingSchema,
    isTyped: !isMissingSchema,
  };
}

type GenerateApiResult = {
  code: string;
  isMissingSchema: boolean; // 是否存在类型丢失
  isTyped: boolean; // 是否请求参数完全类型化
};

/** 生成单个 API 方法 */
function generateApi(options: {
  method: HttpMethod;
  apiPath: string;
  op: OpenApiOperationObject;
  spec: OpenAPISpec;
  render: ApiRenderType;
}): GenerateApiResult {
  const { method, apiPath, op, spec, render } = options;
  const name = generateName(method, apiPath);
  const paramsName = method === "get" ? "params" : "data";

  // 处理路径参数
  const hasPathParam = apiPath.includes("{");
  const url = hasPathParam
    ? `${apiPath.replace(/\{(\w+)\}/g, (_, key) => `\${${paramsName}?.${key}}`)}`
    : `${apiPath}`;

  const requestResult = generateRequestType({ op, spec });
  const responseResult = generateResponseType({ op, spec });

  const apiInfo: ApiInfo = {
    name: name,
    method,
    url,
    paramsName,
    paramsType: method === "get" ? "params" : "data",
    requestType: requestResult.code || "any",
    responseType: responseResult.code || "any",
    summary: op?.summary || "",
  };

  return {
    code: render(apiInfo),
    isMissingSchema:
      requestResult.isMissingSchema || responseResult.isMissingSchema,
    isTyped: requestResult.isTyped || responseResult.isTyped,
  };
}

/** 生成全部 API */
function generateApiCode(
  spec: OpenAPISpec,
  render: ApiRenderType,
): {
  code: string;
  stats: {
    /** api 总数 */
    totalCount: number;
    /** 完整类型 接口数量 */
    typedCount: number;
    /** 完整类型 接口占比 */
    typedRatio: number;
    /** 缺失schema 接口数量 */
    missingCount: number;
    /** 缺失schema 接口地址列表 */
    missingList: string[];
  };
} {
  const result: string[] = [];

  let totalCount = 0;
  let typedCount = 0;
  let missingCount = 0;
  let missingList: string[] = [];

  for (const [apiPath, methods] of Object.entries(spec.paths || {})) {
    for (const [method, op] of Object.entries(methods || {})) {
      const m = normalizeMethod(method);
      if (!m) continue;

      const apiResult = generateApi({
        method: m,
        apiPath,
        op,
        spec,
        render,
      });

      result.push(apiResult.code);

      totalCount++;
      if (apiResult.isTyped) {
        typedCount++;
      }
      if (apiResult.isMissingSchema) {
        missingCount++;
        missingList.push(apiPath);
      }
    }
  }

  return {
    code: result.join("\n\n"),
    stats: {
      totalCount,
      typedCount,
      missingCount,
      missingList,
      typedRatio: totalCount
        ? parseFloat((typedCount / totalCount).toFixed(2))
        : 0,
    },
  };
}

/**
 * 写入输出文件
 * @param projectRoot 项目根目录
 * @param output API 文件生成地址
 * @param code 写入代码
 */
function writeOutputFile({
  projectRoot,
  output,
  code,
}: {
  projectRoot?: string;
  output?: string;
  code: string;
}) {
  const root = projectRoot || process.cwd();
  const resolvedRoot = path.resolve(root);

  if (resolvedRoot === "/" || resolvedRoot === process.env.HOME) {
    throw createError(
      "禁止将 projectRoot 设置为系统根目录或用户主目录",
      "writeOutputFile",
    );
  }

  const outputFile = output || "./api.ts";

  const outputPath = outputFile.startsWith("/")
    ? outputFile
    : path.resolve(resolvedRoot, outputFile);

  if (!outputPath.startsWith(resolvedRoot)) {
    throw createError("输出路径必须位于 projectRoot 目录内", "writeOutputFile");
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, code, "utf-8");

  return outputPath;
}

/** 格式化 MCP 结果 */
function formatMcpResult({
  outputPath,
  stats,
}: {
  outputPath: string;
  stats: {
    /** 接口总数 */
    totalCount: number;
    /** 已生成类型接口数 */
    typedCount: number;
    /** 已丢失类型接口数 */
    missingCount: number;
  };
}): CallToolResultSchema {
  return {
    content: [
      {
        type: "text",
        text: `[MCP执行完成]

前端 API 文件已生成，请勿重复生成代码。

生成文件位置：
${outputPath}

接口统计：
- 总计生成 API 数量：${stats.totalCount}
- 已生成类型接口数：${stats.typedCount}
- 丢失类型接口数：${stats.missingCount}`,
      },
    ],
  };
}

/**
 * 生成 api 页面代码
 * @param options
 */
function generateApiPage(options: {
  /** 所有 import 语句 */
  imports: string;
  /** API 函数之前的顶层代码（不包含 import */
  prelude: string;
  /** api部分生成代码 */
  code: string;
}) {
  return [options?.imports, options?.prelude, options?.code]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * 创建 API 生成模板
 * @param example api 请求实例
 */
function createTemplate(example?: string): string {
  if (example && example?.trim()) {
    return normalizeExampleByAst(example);
  }

  // 默认模板
  return DEFAULT_TEMPLATE;
}

/**
 * createApi 服务（流程编排）
 *
 * @description
 * - 支持“自定义模板（example）生成 API 文件”
 **/
export async function createApiService(input: CreateApiInput) {
  const normalized = normalizeCreateApiInput(input);
  const { projectRoot, output, openapiUrl, example } = normalized;

  // 解析 API 示例
  const parseResult = exampleParser(example);

  // 生成 API 模板
  const template = createTemplate(parseResult.apiExample);

  // 创建 renderer
  const render = createApiRender(template);

  // 获取 openapi 接口信息
  const spec = await fetchJson<OpenAPISpec>(openapiUrl);

  // 生成 api 代码
  const { code, stats } = generateApiCode(spec, render);

  // 生成页面代码
  const pageCode = generateApiPage({
    imports: parseResult.imports || DEFAULT_IMPORTS,
    prelude: parseResult.prelude,
    code,
  });

  // 写入文件
  const outputPath = writeOutputFile({
    projectRoot,
    output,
    code: await formatCode(pageCode, {
      // 用于读取用户项目 prettier 配置
      projectRoot: input?.projectRoot,
    }),
  });

  // 返回 MCP 结果
  return formatMcpResult({
    outputPath,
    stats,
  });
}
