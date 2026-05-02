import { z } from "zod";

/**
 * CreateApi 参数
 */
export const CreateApiInputSchema = z.object({
  /** OpenAPI 地址 */
  openapiUrl: z
    .string()
    .url()
    .optional()
    .describe("Swagger/OpenAPI 文档地址（优先，其次使用环境变量 OPENAPI_URL）"),
  /** 项目工作区根目录 */
  projectRoot: z
    .string()
    .optional()
    .describe("当前项目根目录（必须传入，通常为当前工作区路径）"),
  /** 生成API 路径 */
  output: z
    .string()
    .optional()
    .describe(
      '生成文件路径。仅在用户明确指定输出位置时传入（例如 "./api.ts" 或 "/abs/path/api.ts"）。未指定时必须传空字符串 "" 或不传，不要自行推断路径（例如 "./src/api.ts"）。',
    ),
  /** api 示例 */
  example: z
    .string()
    .optional()
    .describe(
      "可选：API 函数示例（单函数）。要求：未提供时必须为空字符串或不传；禁止包含多个函数；作为原始文本传递（不要任何修改或推断）；",
    ),
});

/**
 * CreateApi 参数类型
 */
export type CreateApiInput = z.infer<typeof CreateApiInputSchema>;

/**
 * createApi 标准化输入
 */
export type CreateApiResolvedInput = {
  /** openapi 地址（json） */
  openapiUrl: string;
  /** 项目根目录 */
  projectRoot: string;
  /** 生成 api 文件位置 */
  output: string;
  /** 用户输入 api 例子 */
  example?: string;
};
