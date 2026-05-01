import prettier, { Options } from "prettier";
import path from "path";

const DEFAULT_PRETTIER_CONFIG: Options = {
  semi: true,
  singleQuote: true,
  trailingComma: "all",
};

/**
 * 格式化代码
 *
 * @param code 待格式代码
 * @param options
 */
export async function formatCode(
  code: string,
  options?: {
    /** 项目根目录（用于自动读取项目下 prettier 配置文件） */
    projectRoot?: string;
  },
): Promise<string> {
  const { projectRoot } = options || {};

  try {
    let config: Options = DEFAULT_PRETTIER_CONFIG;

    if (projectRoot) {
      // 虚拟文件路径，仅用于触发 Prettier 向上查找配置（不会实际读取该文件）
      const filePath = path.join(projectRoot, "index.ts");

      let resolved = await prettier.resolveConfig(filePath, {
        useCache: false,
      });

      if (resolved) {
        config = {
          ...DEFAULT_PRETTIER_CONFIG,
          ...resolved,
        };
      }
    }

    return await prettier.format(code, {
      ...config,
      parser: "typescript",
    });
  } catch (err) {
    console.warn("prettier format failed:", err);
    return code;
  }
}
