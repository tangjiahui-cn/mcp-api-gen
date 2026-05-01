/**
 * 创建工具错误
 */
export function createError(message: string, code?: string) {
  const error = new Error(`[mcp-api-gen] ${message}`);

  if (code) {
    (error as any).code = code;
  }

  return error;
}
