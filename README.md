# mcp-api-gen

基于 MCP 的 OpenAPI 接口生成工具，支持内网文档解析，在 AI 编辑器中实现分钟级批量生成 TypeScript API（实测 200+ 接口约 1 分钟完成）。

> 无需暴露内网 OpenAPI 文档，AI 编辑器（Cursor / Trae）即可直接生成接口代码。

## 快速开始

配置 MCP：

```json
{
  "mcpServers": {
    "mcp-api-gen": {
      "command": "npx",
      "args": ["-y", "mcp-api-gen"]
    }
  }
}
```

一句话提问（默认生成到 ./api.ts）：

> 根据 http://localhost:3000/api-docs.json 生成前端API文件

一句话提问（指定生成目标位置）：

> 根据 http://localhost:3000/api-docs.json 生成前端API文件到 ./service/api.ts

## 本地调试

请确保 Node.js 版本 20+。

```bash
# 安装依赖
pnpm i

# 打包调试
pnpm dev

# MCP 调试
pnpm debug
```
