#!/usr/bin/env node
/**
 * mcp-api-gen
 *
 * 基于 MCP 的 API 生成服务，
 * 用于将 OpenAPI / Swagger 文档生成前端 TypeScript 接口代码。
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerCreateApi } from "@/tool";

export * from "@/tool";

function createServer() {
  const server = new McpServer({
    name: "openapi-to-api",
    version: "0.1.0",
  });

  registerCreateApi(server);

  return server;
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[mcp-api-gen] 服务启动失败:", err);
  process.exit(1);
});
