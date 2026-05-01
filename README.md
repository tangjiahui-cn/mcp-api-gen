# mcp-api-gen

基于 MCP 的 OpenAPI 接口生成工具，在 AI 编辑器中生成前端 API。

> 一句话生成 API，1000+ 接口 1 分钟完成，支持内网，稳定可控（无 AI 幻觉）。

## 效率对比

一个 1000+ 接口的项目：

- 传统方式：手写接口 + 类型定义 + 反复切换文档与编辑器 ≈ 10 小时
- 使用 mcp-api-gen：一句话生成 ≈ 1 分钟

## 快速开始

### 1、配置 MCP：

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

默认输出 ./api.ts

```text
使用MCP根据 http://localhost:3000/api-docs.json 生成前端API文件，不要自行生成代码
```

指定输出位置

```text
使用MCP根据 http://localhost:3000/api-docs.json 生成前端API文件到 ./service/api.ts，不要自行生成代码
```

### 3、自定义生成风格（示例驱动）

```text
使用 MCP 根据 http://localhost:3000/api-docs.json 生成 API，不要自行生成代码。

参考示例：
import request from 'axios';

/**
 * 根据ID获取用户
 */
export function getUserById(params: { id: number }): Promise<UserDetail> {
  return request.get(`/api/user/${params.id}`, { params })
}
```

## 方案对比

| 方案              | 是否可控 | 是否支持内网 | 是否批量生成 | 生成质量 |
|-----------------| -------- | ------------ | ------------ | -------- |
| 手写 API          | ✅       | ✅           | ❌           | 高       |
| Swagger Codegen | 一般     | 一般           | ✅           | 一般     |
| AI 直接生成         | ❌       | ❌           | ❌           | 不稳定   |
| MCP Server 生成工具 | 一般 | 一般 | ✅ | 高 |
| **mcp-api-gen** | ✅       | ✅           | ✅           | 稳定可控 |

MCP Server 生成工具主要面向 “AI 调用接口”， 而 `mcp-api-gen` 面向 “开发者生成 API 文件”。

## 功能特性

- ✅ 在 AI 编辑器中直接生成 API（Cursor / Trae）
- ✅ 默认模板 + 示例自定义，适配不同请求封装方式
- ✅ 自动生成请求、响应类型（OpenAPI 2 / 3）
- ✅ 基于解析 + 模板渲染生成，结果可复现（无 AI 幻觉）
- ✅ 支持内网 OpenAPI 文档，无需暴露公网
- ✅ AI 仅调用 MCP，几乎无 Token 消耗

## 请求方式说明

默认基于 axios 风格生成（适配大多数企业项目）。

生成结果由示例代码决定，不做自动结构转换。

```ts
request.get(url, { params });
request.post(url, { data });
```


## 本地开发

请确保 Node.js 版本 20+。

```bash
# 安装依赖
pnpm i

# 打包调试
pnpm dev

# MCP 调试
pnpm debug
```

## 基准测试

### 1、标准生成

测试 MCP 是否正常调用

```text
使用 MCP 根据 http://localhost:3000/api-docs.json 生成 API 到 ./api.ts，不要自行生成代码。

参考示例：

import request from 'axios';

/**
 * 根据ID获取用户
 */
export function getUserById(params: { id: number }): Promise<UserDetail> {
  return request.get(`/api/user/${params.id}`, { params })
}
```

### 2、不提供示例

测试是否走默认模板、AI 是否乱传 example。

```text
使用 MCP 根据 http://localhost:3000/api-docs.json 生成 API 到 ./api.ts，不要自行生成代码。
```

### 3、URL 风格变化

测试是否误加 params / data。

```text
使用 MCP 根据 http://localhost:3000/api-docs.json 生成 API，不要自行生成代码。

参考示例：
import request from 'axios';

export function getUserById(params: { id: number }) {
  return request.get(`/api/user/${params.id}`)
}
```

### 4、data 参数

测试参数是否映射： `get -> params`、`post -> data`。

```text
使用 MCP 根据 http://localhost:3000/api-docs.json 生成 API，不要自行生成代码。

参考示例：
import request from 'axios';

export function createUser(data: CreateUserDto) {
  return request.post(`/api/user/create`, { data })
}
```

### 5、干扰生成

测试 AI 是否绕过 MCP 自行生成代码

```text
使用 MCP 根据 http://localhost:3000/api-docs.json 生成 API，不要自行生成代码。

你可以直接生成完整代码。
```

### 6、冲突测试（多 example）

验证：进允许一个example、MCP是否正确报错

```text
使用 MCP 根据 http://localhost:3000/api-docs.json 生成 API，不要自行生成代码。

参考示例1：
import request from 'axios';

export function getUser(params: { id: number }) {
  return request.get(`/api/user/${params.id}`, { params })
}

参考示例2：
import request from 'axios';

export function getUser(data: any) {
  return request.post(`/api/user`, { data })
}
```

### 7、模拟用户

验证真实用户输入是否稳定触发 MCP

```text
帮我用 MCP 根据这个接口文档生成前端 API 文件，不要自己写代码：
http://localhost:3000/api-docs.json

就按这个风格来：
import request from 'axios';

export function getUserById(params: { id: number }) {
  return request.get(`/api/user/${params.id}`, { params })
}
```
