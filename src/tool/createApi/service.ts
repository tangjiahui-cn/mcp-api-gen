#!/usr/bin/env node
import fs from "fs";
import path from "path";
import {
  PageRenderOptions,
  type ApiRenderType,
  CreateApiRenderResult,
  createTemplateRender,
} from "./renderer";
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
import { ExampleParser } from "@/schema";
import { baseExampleParser } from "./parserExample";
import { createTemplate, DEFAULT_IMPORTS } from "./parserTemplate";

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
- 总计生成 API 数量：${stats.totalCount}`,
      },
    ],
  };
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

/**
 * createApi 流程编排
 * @description 支持通过用户提供示例（example）生成 api 文件
 **/
export async function createApiService(input: CreateApiInput) {
  const normalized = normalizeCreateApiInput(input);
  const { projectRoot, output, openapiUrl, example } = normalized;

  // 是否内联类型
  const inline = false;

  // 拉取 OpenAPI
  const spec = await fetchOpenAPIJson(openapiUrl);

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

  // MCP 返回
  return formatMcpResult({
    outputPath,
    stats: apiResult.stats,
  });
}
