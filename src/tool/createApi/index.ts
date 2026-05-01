/**
 * createApi
 *
 * @description
 * 根据 OpenAPI/Swagger 地址生成前端 API 调用代码
 */
import { createApiService } from "./service";
import { CreateApiInputSchema } from "./schema";
// @ts-ignore
import type { McpServer } from "@modelcontextprotocol/sdk/dist/esm/server/mcp";

export * from "./service";

const description = `根据 OpenAPI/Swagger 地址生成前端 API 调用代码。

【使用规则】
1. 默认使用内置模板生成 API
2. 只有在用户明确提供“示例代码”时，才使用 example
3. 如果用户未提供示例代码：
   - example 必须为空字符串 "" 或不传
4. 禁止自行构造 example
5. 只有用户明确提供API生成地址，才传入 openapiUrl`;

export function registerCreateApi(server: McpServer) {
  server.registerTool(
    "createAPI",
    {
      inputSchema: CreateApiInputSchema,
      description,
    },
    createApiService,
  );
}
