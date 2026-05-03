/**
 * 格式化注释
 */
export function formatComment(text?: string, isInline?: boolean) {
  if (!text) return "";

  if (isInline) {
    return `/** ${text} */`;
  }

  return `/**
 * ${text}
 */`;
}
