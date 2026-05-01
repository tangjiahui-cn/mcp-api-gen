import { createError } from "@/share";

/**
 * 发起 GET 请求并返回 JSON 数据
 */
export async function fetchJson<T = unknown>(
  url: string,
  options?: { timeout?: number },
): Promise<T> {
  const { timeout = 10000 } = options || {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { signal: controller.signal });

    if (!res.ok) {
      throw createError(await buildHttpError(res), "fetchJson");
    }

    return parseJson<T>(res);
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw createError("fetchJson 请求超时", "fetchJson");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 构建 HTTP 错误信息
 */
async function buildHttpError(res: Response): Promise<string> {
  let detail = "";

  try {
    detail = await res.text();
  } catch {}

  return `fetchJson error: ${res.status} ${res.statusText}${
    detail ? `\n${detail}` : ""
  }`;
}

/**
 * 解析 JSON 响应
 */
async function parseJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw createError("fetchJson 响应不是合法 JSON", "fetchJson");
  }
}
