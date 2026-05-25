# mcp-api-gen

![npm](https://img.shields.io/npm/v/mcp-api-gen)
![license](https://img.shields.io/npm/l/mcp-api-gen)
![node](https://img.shields.io/badge/node-%3E%3D20.0.0-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)
![MCP](https://img.shields.io/badge/MCP-1.29.0-purple)

OpenAPI 接口生成工具，支持在 AI 编辑器中生成前端 API 。

- 🌐 支持内网 OpenAPI 2 / 3 文档解析
- ⚡ 1000+ 接口约 1 分钟完成
- 🧩 用户提供示例（基于模板批量生成）
- 🤖 AI 调用本地生成（结果稳定）

## 功能演示

默认模板生成（axios）：

<img src="https://cdn.jsdelivr.net/gh/tangjiahui-cn/assets@master/mcp-api-gen/one-sentence-generation-v2.gif" style="max-width: 100%;max-height: 500px;" alt="默认模板生成 API"/>

用户提供 API 示例生成：

<img src="https://cdn.jsdelivr.net/gh/tangjiahui-cn/assets@master/mcp-api-gen/user-example-generation-v2.gif" style="max-width: 100%;max-height: 500px;" alt="用户提供 API 示例生成"/>

## 快速开始

请确保已安装 Node.js（>= 20）。

> 暂不支持中文 schema！（极少数情况下后端文档设置 @ApiModel({description: '模型名称'}) ）

### 1、配置 MCP：

在你的 AI 编辑器（如 Cursor / Trae）中添加 MCP 配置：

```json
{
  "mcpServers": {
    "mcp-api-gen": {
      "command": "npx",
      "args": ["-y", "mcp-api-gen@latest"]
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

// API 前缀
const prefix = '/user'

/**
 * 根据ID获取用户
 */
export function getUserById(params: { id: number }): Promise<UserDetail> {
  return request.get(`${prefix}/user/${params.id}`, { params })
}
```

## 为什么做 mcp-api-gen？

当我尝试使用 AI 编辑器来生成 api 文件时，遇到过这几个问题:

- ❌ 内网 OpenAPI 文档无法读取
- ❌ 大量接口生成结果不稳定（上下文截断、格式可能变）
- ❌ Token 消耗高、生成耗时长
- ❌ 不同项目请求风格不一致

我依次尝试了这几类方法：

- V0：AI 编辑器直接读取 OpenAPI 地址（初次尝试 AI 接入开发流）
- V1：MCP 读取内网接口提供给 AI 编辑器（解决内网解析问题）
- V2：MCP 分段读取内网接口提供给 AI（解决大量接口上下文截断问题）
- V3：让 AI 提供 API 实例和字段映射，而不是直接生成（解决了生成不稳定问题）
- 当前：MCP 本地 AST 解析批量生成（解决上述问题。且生成极快、Token 消耗极低、结果稳定）

最终实现了核心目标：

- **简单**。用户提供示例，一句话提问即可生成 API 文件
- **快速**。本地运行生成，1000+ 接口只需 1s 完成
- **稳定**。运行时模板驱动生成，相同结果相同输出

`mcp-api-gen` 的核心思路不是 `AI生成代码`，而是 `AI 调用工具`。因此解决了 AI 生成结果不稳定的问题。

## 功能特性

- ✅ 内网文档解析
- ✅ 基于示例解析 + 模板渲染
- ✅ AI 编辑器直接生成 API 文件（Cursor / Trae）
- ✅ 支持用户提供请求示例
- ✅ 生成完整 TypeScript 类型
- ✅ 支持 OpenAPI 2 / 3
- ✅ Token 消耗极低
- ✅ 大量接口生成极快（1000+ 接口约 1 秒）

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
