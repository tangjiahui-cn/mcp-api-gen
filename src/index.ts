#!/usr/bin/env node
/**
 * mcp-api-gen
 *
 * 将 OpenAPI / Swagger 文档生成前端 TypeScript 接口代码。
 *
 * 运行方式：
 * - 不带任何参数：以 MCP Server（stdio）运行，供 MCP 客户端（Cursor / Trae 等）调用；
 * - 携带参数：以 CLI 模式运行，执行一次生成后退出（mcp-api-gen --help 查看用法）。
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerCreateApi } from "@/tool";
import { runCli } from "@/cli";

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
  // 携带任意参数（含 --help / --version）时进入 CLI 模式
  if (process.argv.length > 2) {
    await runCli();
    return;
  }

  // 无参数：MCP Server 模式（与旧版本行为一致）
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[mcp-api-gen] 服务启动失败:", err);
  process.exit(1);
});
