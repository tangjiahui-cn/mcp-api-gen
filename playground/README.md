# Playground

用于验证 API 自动生成能力的本地环境，内置一份包含 1200+ 接口的模拟 OpenAPI 文档。

---

## 快速开始

要求 Node.js 版本 >= 20。

```bash
# 安装依赖
pnpm i

# 运行文档
pnpm docs:playground
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

验证：仅允许使用一个example、或 MCP 是否正确报错

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
