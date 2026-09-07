#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { createTemplateRender } from "./renderer";
import { formatCode, createError, fetchOpenAPIJson } from "@/share";
// @ts-ignore
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/dist/esm/types";
import type { CreateApiInput } from "./schema";
import { normalizeCreateApiInput } from "./normalize";
import {
  createTsApiInfo,
  generateApiResult,
  generateTsTypes,
} from "./generate";
import { collectModels } from "@/tool/createApi/collect";
import {
  ExampleParser,
  PageRenderOptions,
  ApiRenderType,
  CreateApiRenderResult,
  SchemaObject,
  OpenAPISpec,
} from "@/schema";
import { baseExampleParser } from "./parserExample";
import { createTemplate, DEFAULT_IMPORTS } from "./parserTemplate";

/**
 * 检查 Node.js 版本不低于 minMajor
 * @param minMajor Node.js 主版本号
 */
function checkNodeVersion(minMajor: number = 20) {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < minMajor) {
    throw createError(`Node.js >= ${minMajor} required`);
  }
}

/**
 * TypeScript 实例解析器
 */
const tsExampleParser: ExampleParser = async (example) => {
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
  projectRoot: string;
  output: string;
  code: string;
}) {
  const resolvedRoot = path.resolve(projectRoot);

  const outputPath = output.startsWith("/")
    ? output
    : path.resolve(resolvedRoot, output);

  // 最终防线：禁止路径逃逸
  if (!outputPath.startsWith(resolvedRoot)) {
    throw createError("输出路径必须位于 projectRoot 目录内", "writeOutputFile");
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, code, "utf-8");

  return outputPath;
}

/**
 * 格式化 MCP 结果
 */
function formatMcpResult({
  outputPath,
  stats,
}: {
  outputPath: string;
  stats: {
    /** 接口总数 */
    totalCount: number;
    /** 是否有中文schema */
    isHasChineseSchemas?: boolean;
  };
}): CallToolResultSchema {
  return {
    content: [
      {
        type: "text",
        text: [
          `[MCP执行完成]

前端 API 文件已生成，请勿重复生成代码。

生成文件位置：
${outputPath}

接口统计：
- 总计生成 API 数量：${stats.totalCount}`,
          stats?.isHasChineseSchemas &&
            `存在中文 schema，已自动转为内联类型模式。`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
  };
}

/**
 * createApi 生成结果数据（MCP / CLI 共用）
 */
export type CreateApiDone = {
  /** 生成文件绝对路径 */
  outputPath: string;
  /** 接口总数 */
  totalCount: number;
  /** 是否存在中文 schema */
  isHasChineseSchemas?: boolean;
};

/**
 * 格式化终端完成文本（CLI 模式打印）
 */
export function formatApiDoneText(done: CreateApiDone): string {
  const { outputPath, totalCount, isHasChineseSchemas } = done;

  return [
    "执行成功。",
    `生成文件位置：\n${outputPath}`,
    `接口统计：\n- 总计生成 API 数量：${totalCount}`,
    isHasChineseSchemas && "存在中文 schema，已自动转为内联类型模式。",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * 创建 TypeScript 类型的 API 渲染器
 * @param example 用户提供的 api 示例
 * @param inline api 实例类型是否内联
 */
async function createTsApiRenderer(
  example?: string,
  inline?: boolean,
): Promise<CreateApiRenderResult> {
  // 解析 API 示例
  const parseResult = await tsExampleParser(example);

  // 创建模板渲染器
  const templateRender = createTemplateRender(parseResult.template);

  // 渲染函数（将单个 API 信息渲染成代码）
  const render: ApiRenderType = (ctx) => {
    const tsApiInfo = createTsApiInfo(ctx.apiInfo, ctx.refs, { inline });

    return templateRender(tsApiInfo);
  };

  return {
    imports: parseResult.imports,
    prelude: parseResult.prelude,
    render,
  };
}

/**
 * 创建 TypeScript 类型的页面渲染器
 * @param options
 */
export function tsPageRender(options: PageRenderOptions): string {
  const tsTypes = generateTsTypes(options.models);
  const prelude = [tsTypes, options.prelude].filter(Boolean).join("\n\n");

  return [options?.header, options?.imports, prelude, options.apis]
    .filter(Boolean)
    .join("\n\n");
}

type Schemas = Record<string, SchemaObject>;

/**
 * 判断是否有中文 schema
 */
function isHasChineseSchema(schemas: Schemas): boolean {
  return Object.keys(schemas).some((name) => {
    return /[\u4e00-\u9fa5]/.test(name);
  });
}

/**
 * 获取 OpenAPI schema 集合
 */
export function resolveSchemas(spec: OpenAPISpec): Schemas {
  // OpenAPI 3
  if (spec.components?.schemas) {
    return spec.components.schemas;
  }

  // Swagger 2
  if (spec.definitions) {
    return spec.definitions;
  }

  return {};
}

const DEFAULT_INLINE = false; // 类型是否内联

/**
 * createApi 生成核心（MCP / CLI 共用）
 * @description 支持通过用户提供示例（example）生成 api 文件
 **/
export async function runCreateApi(
  input: CreateApiInput,
): Promise<CreateApiDone> {
  // 确保 Node.js 版本在 20 及以上
  checkNodeVersion(20);

  // 初始化信息
  const normalized = normalizeCreateApiInput(input);
  const { projectRoot, output, openapiUrl, example } = normalized;

  // 拉取 OpenAPI（http(s) 地址或本地 JSON 文件）
  const spec = await fetchOpenAPIJson(openapiUrl);
  const schemas = resolveSchemas(spec);
  const isHasChineseSchemas = isHasChineseSchema(schemas);

  // 是否内联类型
  const inline = isHasChineseSchemas || DEFAULT_INLINE;

  // 创建 renderer（TODO：自定义 apiRenderer）
  const renderer = await createTsApiRenderer(example, inline);

  // 生成 api
  const apiResult = generateApiResult(spec, renderer.render);
  const models = inline ? [] : collectModels(apiResult.apiList, spec);

  // 生成页面代码 （TODO: 自定义 pageRender）
  const pageCode = tsPageRender({
    models,
    imports: renderer.imports,
    prelude: renderer.prelude,
    apis: apiResult.apiList.map((x) => x.code).join("\n\n"),
  });

  // 写文件（自动读取项目 prettier 配置）
  const outputPath = writeOutputFile({
    projectRoot,
    output,
    code: await formatCode(pageCode, {
      projectRoot: input?.projectRoot,
    }),
  });

  return {
    outputPath,
    totalCount: apiResult.stats.totalCount,
    isHasChineseSchemas,
  };
}

/**
 * createApi MCP 工具服务（MCP 模式返回）
 * @description 支持通过用户提供示例（example）生成 api 文件
 **/
export async function createApiService(input: CreateApiInput) {
  const done = await runCreateApi(input);

  return formatMcpResult({
    outputPath: done.outputPath,
    stats: {
      totalCount: done.totalCount,
      isHasChineseSchemas: done.isHasChineseSchemas,
    },
  });
}
