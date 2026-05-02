import type { OpenAPISpec } from "@/schema";
import { createError } from "@/share";
import { fetchJson } from "./fetchJson";

const COMMON_PATHS = [
  "/v3/api-docs",
  "/api-docs",
  "/api-docs.json",
  "/openapi.json",
  "/swagger/doc.json",
];

/**
 * 获取 OpenAPI JSON
 */
export async function fetchOpenAPIJson(
  openapiUrl: string,
  options?: { timeout?: number },
): Promise<OpenAPISpec> {
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
