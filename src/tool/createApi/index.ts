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

const description = `根据 OpenAPI / Swagger 文档生成前端 API 文件。

【核心规则】
- 必须优先调用 MCP 工具生成
- 禁止 AI 自行编写 API 代码
- 默认使用内置模板生成

【参数规则】

1. openapiUrl
- 只有用户明确提供接口文档地址时才传入

2. output
- 只有用户明确指定输出路径时才传入
- 禁止自行推断路径

3. example
- 只要用户提供了代码风格、示例代码、参考代码等内容，
  就必须原样传入 example
- 禁止修改
- 禁止总结
- 禁止省略
- 未提供时必须为空字符串 "" 或不传
- 禁止 AI 自行构造 example

【以下情况必须传 example】
- 按这个风格生成
- 参考下面代码
- 用这种格式
- 示例代码如下
- 类似下面代码

【正确示例】

用户：

按这个风格生成：

export function getUserById(params: { id: number }) {
  return request.get(\`/api/user/\${params.id}\`, { params })
}

正确调用：

{
  "example": "export function getUserById(params: { id: number }) { ... }"
}`;

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
