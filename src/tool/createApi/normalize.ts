import { CreateApiInput, CreateApiResolvedInput } from "./schema";
import { HttpMethod } from "@/types";
import { createError } from "@/share";

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
 * 标准化 HTTP 方法
 */
export function normalizeMethod(method: string): HttpMethod | null {
  const m = method.toLowerCase();
  return ["get", "post", "put", "delete", "patch"].includes(m)
    ? (m as HttpMethod)
    : null;
}
