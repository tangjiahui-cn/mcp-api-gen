/**
 * 转换为驼峰命名
 *
 * @param input 输入文本
 * @param isFirst 是否首字母大写（默认 true）
 *
 * 示例：
 * 'user-name' -> 'userName'
 * 'get_user_by_id' -> 'getUserById'
 * '/api/user/list' -> 'apiUserList'
 */
export function toCamelCase(input: string, isFirst: boolean = true): string {
  if (!input) return "";

  const words: string[] = splitWords(input);

  return words
    .map((word: string, index: number) => {
      const lower = word.toLowerCase();

      // 首词
      if (index === 0) {
        return isFirst ? lower : capitalize(lower);
      }

      // 其余词：首字母大写
      return capitalize(lower);
    })
    .join("");
}

/**
 * 拆分字符串为单词数组
 */
function splitWords(input: string = ""): string[] {
  return (
    input
      // 非字母数字 -> 空格
      .replace(/[^a-zA-Z0-9]/g, " ")
      // 驼峰拆分：aB -> a B
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      // 驼峰拆分：APIUser => API User
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .split(/\s+/)
      .filter(Boolean)
  );
}

/**
 * 首字母大写
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
