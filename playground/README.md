# Playground

用于验证 API 自动生成能力的本地环境，内置一份包含 1200+ 接口的模拟 OpenAPI 文档。

---

## 运行步骤

启动服务：

```bash
# 请确保 Node.js 版本 20+。
pnpm i

pnpm dev
```

服务启动后，将提供本地 Swagger 地址：

```text
http://localhost:10008/api-docs.json
```

---

## AI 编辑器提问（直接复制）

```text
根据 http://localhost:10008/api-docs.json 生成前端 API，使用 MCP 工具处理，不要自行生成代码。
```

---

## 预期结果

- 生成文件：`./api.ts`（或默认路径）
- 接口数量：1200+
- 耗时：约 1 分钟

生成内容包括：

- 请求方法（GET / POST 等）
- TypeScript 类型定义
- 接口注释（来自 OpenAPI）

---

## 说明

- 生成过程不是逐条调用 AI，而是通过 MCP 解析 OpenAPI 后按模板批量生成
- 因此不会受到 token 限制，可以稳定处理大规模接口

---

## 验证方式

如需确认生成结果：

- 打开生成的 `api.ts`
- 检查接口数量及类型定义是否完整

## 常见问题

### 1. 没有调用 MCP，而是 AI 直接生成代码

可能原因：

- Prompt 不明确
- MCP 未被正确识别

解决办法：
- 提供更强的 Prompt 约束，例如：“使用 MCP”、“不要自行生成代码”。

### 2. 无法访问 api-docs.json

检查项：

- 服务是否正常启动
- 端口是否被占用（10008）
- 浏览器访问 http://localhost:10008/api-docs.json
是否返回 JSON

### 3. 生成接口数量异常（明显偏少）

可能原因：

- OpenAPI 未完整解析
- MCP 执行中断

解决办法：

- 重新执行一次生成
- 查看终端日志是否报错