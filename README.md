# mcp-api-gen

![npm](https://img.shields.io/npm/v/mcp-api-gen)
![license](https://img.shields.io/npm/l/mcp-api-gen)
![node](https://img.shields.io/badge/node-%3E%3D20.0.0-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)
![MCP](https://img.shields.io/badge/MCP-1.29.0-purple)

OpenAPI 接口生成工具，支持在 AI 编辑器中生成前端 API。

- ⚡ 1000+ 接口约 1 分钟完成（playground 可验证）
- 🌐 支持内网 OpenAPI 2 / 3 文档解析
- 🧩 基于模板生成（结果可控、无 AI 幻觉）

## 功能演示

默认模板生成（axios）：

<img src="https://cdn.jsdelivr.net/gh/tangjiahui-cn/assets@master/mcp-api-gen/one-sentence-generation-v2.gif" style="max-width: 100%;max-height: 500px;" alt="默认模板生成 API"/>

用户提供 API 示例生成：

<img src="https://cdn.jsdelivr.net/gh/tangjiahui-cn/assets@master/mcp-api-gen/user-example-generation-v2.gif" style="max-width: 100%;max-height: 500px;" alt="用户提供 API 示例生成"/>

## 快速开始

请确保已安装 Node.js（>= 20）。

### 1、配置 MCP：

在你的 AI 编辑器（如 Cursor / Trae）中添加 MCP 配置：

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

### 2、一句话生成

在 AI 编辑器中输入提问：

#### 默认输出（生成到 `./api.ts`）

```text
使用MCP根据 http://localhost:3000/api-docs.json 生成前端API文件，不要自行生成代码
```

#### 指定输出位置

```text
使用MCP根据 http://localhost:3000/api-docs.json 生成前端API文件到 ./service/api.ts，不要自行生成代码
```

> 说明：http://localhost:3000/api-docs.json 地址需本地运行此项目的 [playground 文档服务](./playground/README.md)。

### 3、自定义生成风格（提供 API 示例）

在 AI 编辑器中输入提问：

```text
使用 MCP 根据 http://localhost:3000/api-docs.json 生成 API，不要自行生成代码。

参考示例：
import request from 'axios';

const prefix = '/user'

/**
 * 根据ID获取用户
 */
export function getUserById(params: { id: number }): Promise<UserDetail> {
  return request.get(`${prefix}/user/${params.id}`, { params })
}
```

## 方案对比

| 方案                | 是否可控 | 是否支持内网 | 是否批量生成 | 生成质量 |
| ------------------- | -------- | ------------ | ------------ | -------- |
| 手写 API            | ✅       | ✅           | ❌           | 高       |
| Swagger Codegen     | 一般     | 一般         | ✅           | 一般     |
| AI 直接生成         | ❌       | ❌           | ❌           | 不稳定   |
| MCP Server 生成工具 | 一般     | 一般         | ✅           | 高       |
| **mcp-api-gen**     | ✅       | ✅           | ✅           | 稳定可控 |

MCP Server 工具通常用来提供接口能力，需要多次调用完成生成。而 mcp-api-gen 可在 AI 编辑器中直接生成 API 文件，一次调用即可生成。

## 功能特性

- ✅ 基于示例解析 + 模板渲染（无 AI 幻觉）
- ✅ AI 编辑器生成 API（Cursor / Trae）
- ✅ 支持定制请求模板
- ✅ 生成 TypeScript 类型（请求 / 响应）
- ✅ 支持 OpenAPI 2 / 3
- ✅ 内网文档解析
- ✅ Token 消耗极低（MCP）

## 请求方式说明

默认按 axios 风格生成，生成结果由示例代码决定，不做额外结构转换。

```ts
request.get(url, { params });
request.post(url, { data });
```

## 本地开发

### 1、启动项目

要求 Node.js 版本 >= 20。

```bash
# 安装依赖
pnpm i

# 构建（开发模式）
pnpm dev

# Tool 测试
pnpm debug

# MCP 调试
pnpm debug:mcp
```

### 2、运行文档示例

启动 playground 文档服务，确认以下地址可访问：

```text
http://localhost:3000/api-docs.json
```

```shell
# 启动文档
pnpm docs:playground
```

## 基准测试

见 [./playground/README.md#基准测试](./playground/README.md#基准测试)。
