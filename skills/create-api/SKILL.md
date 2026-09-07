---
name: create-api
description: Generate a frontend TypeScript API file in bulk from an OpenAPI / Swagger document using mcp-api-gen. Use when the user asks to generate the frontend API / api file / endpoint code from an API document (URL or local JSON). Prefer the Skill flow and run the provided CLI commands; never write API code yourself. Triggers is generate api, create api file, generate frontend api from openapi/swagger, api file from api docs, mcp-api-gen
---

# create-api — Generate a frontend API file from OpenAPI / Swagger

## When to use

- The user asks to "generate the frontend API (file) from / using an OpenAPI (Swagger) document"
- The user provides an API document URL (intranet http(s) URL or a local JSON file) and wants a file like `api.ts` generated
- The user provides example code and says "generate in this style / follow the code below"

> This generates **API call code files**, unrelated to business page code; if the user's intent is to write specific page logic, this skill does not apply.

## Hard rules

1. **openapiUrl**: only pass it when the user explicitly provides the document URL (or an `OPENAPI_URL` env var exists); otherwise stop and ask the user for the URL — never guess.
2. **output**: only pass it when the user explicitly specifies the output location; **never infer a path yourself** (e.g. do not invent `./src/api.ts`); the default output is `./api.ts`.
3. **example**: when the user provides a code style / example snippet, pass it **verbatim, complete and unmodified** via `--example` — do not change, summarize, truncate, or construct an example yourself; omit it when none is provided.
4. **projectRoot**: always required; it is the writable project root (e.g. the current workspace); must not be the filesystem root `/` or the user home directory.
5. The goal is a deterministic artifact: **trust the actual CLI output**, never pretend in prose that the file was generated before running it.

## Prerequisites

- Node.js >= 20
- One API document source: a remote http(s) URL (intranet supported), or a local OpenAPI JSON file path (`file://` / relative / absolute all work — anything not starting with `http(s)://` is read as a local file)
- The project must be runnable: **always execute via `npx -y mcp-api-gen@latest`** — `@latest` makes npx fetch the latest version and `-y` skips the install confirmation; both are required

## Parameter reference (1:1 with the MCP `createAPI` tool parameters)

| Param | CLI option | Required | Description |
| --- | --- |----| --- |
| openapiUrl | `--openapiUrl` / `--openapi-url` | Yes | Document http(s) URL or a local JSON file; falls back to the `OPENAPI_URL` env var (an error is raised only when neither exists) |
| projectRoot | `--projectRoot` / `--project-root` | Yes | Project root: the base directory the file is written into; filesystem root / user home are rejected |
| output | `--output` | No | Output file path, relative to projectRoot or absolute; must stay inside projectRoot; default `./api.ts` |
| example | `--example` | No | API function example (a single function, raw text); wrap multi-line snippets in quotes |

Misc: `-h, --help` prints help; `-v, --version` prints the version (also via `npx -y mcp-api-gen@latest --help` / `--version`). Exit code 0 on success; on failure the error goes to stderr and the process exits non-zero.

> Note: the CLI prints its progress/error messages in Chinese by default — see "Successful output" and "Troubleshooting" below to recognize them.

## Examples (CLI invocation)

```bash
# Default output: ./api.ts
npx -y mcp-api-gen@latest --openapiUrl http://localhost:3000/api-docs.json --projectRoot .

# Specify the output location
npx -y mcp-api-gen@latest --openapiUrl http://localhost:3000/api-docs.json --projectRoot . --output src/service/api.ts

# User provided a style example: pass it verbatim (use single quotes when it contains backticks / ${})
npx -y mcp-api-gen@latest --openapiUrl http://localhost:3000/api-docs.json --projectRoot . \
  --example 'export function getUserById(params: { id: number }): Promise<UserDetail> {
    return request.get(`/api/user/${params.id}`, { params })
  }'

# Local OpenAPI JSON file
npx -y mcp-api-gen@latest --openapiUrl ./api-docs.json --projectRoot .
```

A successful run prints something like:

```
执行成功。

生成文件位置：
/abs/path/to/project/api.ts

接口统计：
- 总计生成 API 数量：12
```

## Skill usage (standard agent flow)

1. **Confirm the document source**: extract openapiUrl from the user's message (http(s) URL or a local JSON path); if the user did not mention one and there is no `OPENAPI_URL`, ask first — do not guess.
2. **Confirm where the file goes**: projectRoot = the current project workspace root (use its real absolute path); set output only when the user explicitly gives an output path, otherwise keep the default `./api.ts`.
3. **Forward the example verbatim**: if the user provided any style / example snippet, extract it as-is into example; only a single function is allowed per example — confirm with the user when there are several.
4. **Run the CLI**: execute the commands above from projectRoot, always with `npx -y mcp-api-gen@latest` (`-y` must not be dropped).
5. **Verify the result**: rely on the command's stdout / exit code; on failure report the stderr message to the user and retry after fixing per its hint — do not bypass the tool and hand-write code.
6. Repeat steps 1–5 for multiple documents / runs.

## Troubleshooting

| Observed on stderr | Cause & fix |
| --- | --- |
| `缺少 openapiUrl` | No URL given and no `OPENAPI_URL`; ask the user for the document URL |
| `projectRoot 必须传入` | projectRoot is missing; pass the current workspace root |
| `禁止将 projectRoot 设置为系统根目录或用户主目录` | projectRoot is out of bounds; use a real project directory |
| `本地 OpenAPI 文件不存在或不可读` | Wrong local JSON path; verify the file exists (relative paths and `file://` are supported) |
| `本地文件不是合法 JSON` / `本地文件数据格式不正确，非 OpenAPI` | Corrupted file or the document is not OpenAPI 2/3 |
| `输出路径必须位于 projectRoot 目录内` | output escapes projectRoot; use a path inside projectRoot |

## Notes

- Intranet URLs cannot be reached from outside; this is a core supported scenario: the CLI runs locally on the user's machine and reads the intranet document directly — no need to copy the document content into the conversation.
- Chinese schema names are not supported yet (except rare Chinese model names in backend documents, which are automatically converted to inline type mode with a notice).
- The default output style is decided by the built-in template; if the project has a unified request wrapper or an established style, ask the user to provide an example snippet and forward it via `--example` for stable, consistent results.
