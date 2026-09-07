import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { OpenAPISpec } from "@/schema";
import { createError } from "./error";
import { fetchJson } from "./fetchJson";

const COMMON_PATHS = [
  "/v3/api-docs",
  "/api-docs",
  "/api-docs.json",
  "/openapi.json",
  "/swagger/doc.json",
];

/** 是否 http(s) 远程地址 */
function isRemoteUrl(source: string): boolean {
  return /^https?:\/\//i.test(source);
}

/**
 * 将本地来源（file:// 或文件路径）解析为绝对路径
 */
function resolveLocalFilePath(source: string): string {
  if (/^file:\/\//i.test(source)) {
    try {
      return fileURLToPath(source);
    } catch {
      throw createError(`file 地址不正确：${source}`, "fetchOpenAPIJson");
    }
  }
  // 相对路径相对当前工作目录解析
  return path.resolve(source);
}

/**
 * 读取本地 OpenAPI JSON 文件
 */
async function loadLocalOpenAPIJson(source: string): Promise<OpenAPISpec> {
  const filePath = resolveLocalFilePath(source);

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    throw createError(
      `本地 OpenAPI 文件不存在或不可读：${filePath}`,
      "fetchOpenAPIJson",
    );
  }

  let spec: unknown;
  try {
    spec = JSON.parse(raw);
  } catch {
    throw createError(`本地文件不是合法 JSON：${filePath}`, "fetchOpenAPIJson");
  }

  if (!isOpenAPI(spec)) {
    throw createError("本地文件数据格式不正确，非 OpenAPI", "fetchOpenAPIJson");
  }

  return spec;
}

/**
 * 获取 OpenAPI JSON
 */
export async function fetchOpenAPIJson(
  openapiUrl: string,
  options?: { timeout?: number },
): Promise<OpenAPISpec> {
  // 本地来源：file:// 或文件路径（CLI 传 --openapiUrl ./api-docs.json 等）
  if (!isRemoteUrl(openapiUrl)) {
    return loadLocalOpenAPIJson(openapiUrl);
  }

  try {
    const spec = await fetchJson<OpenAPISpec>(openapiUrl, options);
    if (isOpenAPI(spec)) return spec;
  } catch {}

  const base = getBaseUrl(openapiUrl);
  const controllers = COMMON_PATHS.map(() => new AbortController());

  let resolved = false;
  let rejectCount = 0;

  return new Promise<OpenAPISpec>((resolve, reject) => {
    COMMON_PATHS.forEach((path, index) => {
      const url = base + path;
      const controller = controllers[index];

      fetchJson<OpenAPISpec>(url, {
        ...options,
        signal: controller.signal as any,
      })
        .then((spec) => {
          if (resolved) return;

          if (isOpenAPI(spec)) {
            resolved = true;

            controllers.forEach((c) => c.abort());

            resolve(spec);
            return;
          }

          // 非 OpenAPI
          throw createError("接口数据格式不正确，非 OpenAPI");
        })
        .catch(() => {
          if (resolved) return;

          rejectCount++;

          if (rejectCount === COMMON_PATHS.length) {
            reject(createError("地址不正确，未找到 OpenAPI 文档"));
          }
        });
    });
  });
}

/**
 * 判断是否为 OpenAPI 2/3
 */
function isOpenAPI(obj: any): obj is OpenAPISpec {
  return (
    obj &&
    typeof obj === "object" &&
    obj.paths &&
    (typeof obj.openapi === "string" || typeof obj.swagger === "string")
  );
}

/**
 * 获取 baseURL
 */
function getBaseUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    throw createError("地址不正确，未找到 OpenAPI 文档");
  }
}
