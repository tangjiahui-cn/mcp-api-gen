# mcp-api-gen

**English** | [简体中文](./README.zh-CN.md)

![npm](https://img.shields.io/npm/v/mcp-api-gen)
![license](https://img.shields.io/npm/l/mcp-api-gen)
![node](https://img.shields.io/badge/node-%3E%3D20.0.0-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)
![MCP](https://img.shields.io/badge/MCP-1.29.0-purple)

An OpenAPI API generation tool that generates frontend API code inside AI editors.

- 🌐 Parse intranet OpenAPI 2 / 3 documents
- ⚡ 1000+ endpoints in about a minute
- 🧩 Bring your own examples (bulk generation driven by a template)
- 🤖 Generated locally via AI tool calls (deterministic results)

## Demo

Generated with the default template (axios):

<img src="https://cdn.jsdelivr.net/gh/tangjiahui-cn/assets@master/mcp-api-gen/one-sentence-generation-v2.gif" style="max-width: 100%;max-height: 500px;" alt="Generate APIs with the default template"/>

Generated with a user-provided API example:

<img src="https://cdn.jsdelivr.net/gh/tangjiahui-cn/assets@master/mcp-api-gen/user-example-generation-v2.gif" style="max-width: 100%;max-height: 500px;" alt="Generate APIs with a user-provided example"/>

## Quick Start

Make sure Node.js (>= 20) is installed.

> Chinese schema names are not supported yet (except for the rare case where the backend document sets `@ApiModel({description: '模型名称'})`).

### 1. Configure MCP

Add the MCP config to your AI editor (e.g. Cursor / Trae):

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

### 2. One-sentence generation

Type the request in your AI editor:

#### Default output (generated to `./api.ts`)

```text
Use MCP to generate the frontend API file from http://localhost:3000/api-docs.json. Do not generate the code yourself.
```

#### Specify the output location

```text
Use MCP to generate the frontend API file from http://localhost:3000/api-docs.json into ./service/api.ts. Do not generate the code yourself.
```

> Note: http://localhost:3000/api-docs.json requires running this project's [playground doc server](./playground/README.md) locally.

### 3. Customize the generation style (provide an API example)

Type the request in your AI editor:

```text
Use MCP to generate APIs from http://localhost:3000/api-docs.json. Do not generate the code yourself.

Reference example:
import request from 'axios';

// API prefix
const prefix = '/user'

/**
 * Get a user by ID
 */
export function getUserById(params: { id: number }): Promise<UserDetail> {
  return request.get(`${prefix}/user/${params.id}`, { params })
}
```

## CLI Usage

Besides calling it via MCP, `mcp-api-gen` can also generate directly from the command line:

```bash
# Default output: ./api.ts
mcp-api-gen --openapiUrl http://localhost:3000/api-docs.json --projectRoot .

# Specify the output path and an API style example
mcp-api-gen --openapiUrl http://localhost:3000/api-docs.json \
  --projectRoot . --output src/service/api.ts \
  --example 'export function getUserById(params: { id: number }) { return request.get(`/api/user/${params.id}`, { params }) }'

# Use a local OpenAPI JSON file
mcp-api-gen --openapiUrl ./api-docs.json --projectRoot .
```

Options match the MCP tool parameters:

| Option | Description | Default |
| --- | --- | --- |
| `--openapiUrl` / `--openapi-url` | Swagger/OpenAPI document URL, or a local JSON file (`file://` / relative / absolute path — anything not starting with `http(s)://` is read as a local file) | env var `OPENAPI_URL` |
| `--projectRoot` / `--project-root` | Project root directory (required) | - |
| `--output` | Generated file path | `./api.ts` |
| `--example` | API function example (raw text) | - |

> Running `mcp-api-gen` without any arguments starts the MCP Server mode for MCP clients; run `mcp-api-gen --help` for more options.

## Skill Usage

Besides MCP / CLI, the repository ships a `skills/create-api` skill in its root directory, so agents that support Agent Skills (Claude Code, Cursor, Trae, etc.) can consume this project as **Skill + CLI** without configuring MCP:

```bash
npx skills add tangjiahui-cn/mcp-api-gen --skill create-api
```

## Why mcp-api-gen?

When I tried using AI editors to generate API files, I ran into these problems:

- ❌ Intranet OpenAPI documents could not be read
- ❌ Unstable output for a large number of endpoints (context truncation, possible format drift)
- ❌ High token consumption and slow generation
- ❌ Inconsistent request styles across projects

Here is the path I took:

- V0: The AI editor read the OpenAPI URL directly (first attempt at bringing AI into the dev flow)
- V1: MCP reads intranet endpoints and exposes them to the AI editor (solves intranet parsing)
- V2: MCP reads intranet endpoints in chunks and feeds them to the AI (solves context truncation for many endpoints)
- V3: Let the AI provide API examples and field mappings instead of generating directly (solves unstable generation)
- Current: MCP generates in bulk via local AST parsing (solves all of the above — blazing fast, minimal tokens, stable results)

The core goals:

- **Simple**. Provide an example and ask in one sentence to generate the API file
- **Fast**. Generation runs locally; 1000+ endpoints take about 1 second
- **Stable**. Template-driven generation at runtime — same input, same output

The core idea of `mcp-api-gen` is not `AI writing code`, but `AI calling a tool`. That is what makes the output stable.

## Features

- ✅ Intranet document parsing
- ✅ Example-based parsing + template rendering
- ✅ Generate API files directly in AI editors (Cursor / Trae)
- ✅ User-provided request examples
- ✅ Full TypeScript type generation
- ✅ OpenAPI 2 / 3 support
- ✅ Minimal token consumption
- ✅ Extremely fast with many endpoints (1000+ endpoints in about 1 second)

## Request style

Code is generated in axios style by default; the result is decided by the example code, with no extra structural conversion.

```ts
request.get(url, { params });
request.post(url, { data });
```

## Local development

### 1. Start the project

Requires Node.js >= 20.

```bash
# Install dependencies
pnpm i

# Build (development mode)
pnpm dev

# Test the tool
pnpm debug

# Debug the MCP server
pnpm debug:mcp
```

### 2. Run the playground doc server

Start the playground doc server and make sure this URL is reachable:

```text
http://localhost:3000/api-docs.json
```

```shell
# Start the doc server
pnpm docs:playground
```

## Benchmarks

See [./playground/README.md](./playground/README.md) (benchmark section).
