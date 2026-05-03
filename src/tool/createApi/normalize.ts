import { CreateApiInput, CreateApiResolvedInput } from "./schema";
import { HttpMethod } from "@/types";
import { createError } from "@/share";
import path from "path";

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

  // 解析 openapiUrl 地址
  const url = getString(openapiUrl) || getString(process.env.OPENAPI_URL);

  if (!url) {
    throw createError(
      "缺少 openapiUrl，请通过参数或环境变量 OPENAPI_URL 指定",
      "normalizeCreateApiInput",
    );
  }

  // projectRoot 校验
  if (!projectRoot?.trim()) {
    throw createError(
      "projectRoot 必须传入（通常为当前工作区路径）",
      "normalizeCreateApiInput",
    );
  }

  const trimmedRoot = projectRoot.trim();
  const resolvedRoot = path.resolve(trimmedRoot);

  // 禁止写入系统关键目录
  if (resolvedRoot === "/" || resolvedRoot === process.env.HOME) {
    throw createError(
      "禁止将 projectRoot 设置为系统根目录或用户主目录",
      "normalizeCreateApiInput",
    );
  }

  // output 默认值
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
 * 标准化 HTTP 方法
 */
export function normalizeMethod(method: string): HttpMethod | null {
  const m = method.toLowerCase();
  return ["get", "post", "put", "delete", "patch"].includes(m)
    ? (m as HttpMethod)
    : null;
}
