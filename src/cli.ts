/**
 * CLI 入口
 *
 * 支持直接通过命令行调用生成：
 * mcp-api-gen --openapiUrl <url|本地JSON> --projectRoot <dir> [--output <path>] [--example <code>]
 */
import { parseArgs } from "node:util";
import pkg from "../package.json" with { type: "json" };
import { formatApiDoneText, runCreateApi } from "@/tool/createApi/service";

/** CLI 帮助文本 */
const HELP_TEXT = `用法：mcp-api-gen [选项]

根据 OpenAPI / Swagger 文档生成前端 API 文件（CLI 模式）。

选项：
  --openapiUrl, --openapi-url <url|path>   文档地址，或本地 JSON 文件（file:// / 相对、绝对路径，缺省用环境变量 OPENAPI_URL）
  --projectRoot, --project-root <dir>      项目根目录（必填，生成文件落盘根目录）
  --output <path>                          生成文件路径（默认 ./api.ts）
  --example <code>                         API 函数示例（原始文本）
  -h, --help                               显示本帮助
  -v, --version                            显示版本号

示例：
  mcp-api-gen --openapiUrl http://localhost:3000/api-docs.json --projectRoot ./my-project
  mcp-api-gen --openapi-url http://localhost:3000/api-docs.json --project-root . --output src/api.ts
  mcp-api-gen --openapiUrl ./api-docs.json --projectRoot .

说明：
  不带任何选项运行时进入 MCP Server 模式，供 MCP 客户端（Cursor / Trae 等）调用。`;

/** 解析 CLI 参数为 CreateApiInput（未知选项/裸参数会抛出 parseArgs 错误） */
function parseCliArgs(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
      openapiUrl: { type: "string" },
      "openapi-url": { type: "string" },
      projectRoot: { type: "string" },
      "project-root": { type: "string" },
      output: { type: "string" },
      example: { type: "string" },
    },
    strict: true,
    allowPositionals: false,
  });

  return {
    input: {
      openapiUrl: values.openapiUrl ?? values["openapi-url"],
      projectRoot: values.projectRoot ?? values["project-root"],
      output: values.output,
      example: values.example,
    },
    help: values.help ?? false,
    version: values.version ?? false,
  };
}

/** 打印错误信息并退出 1 */
function exitWithError(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  // createError 已带 [mcp-api-gen] 前缀，避免重复
  console.error(message.startsWith("[mcp-api-gen]") ? message : `[mcp-api-gen] ${message}`);

  const code =
    typeof err === "object" && err !== null && "code" in err
      ? (err as { code?: unknown }).code
      : undefined;
  if (typeof code === "string" && code.startsWith("ERR_PARSE_ARGS_")) {
    console.error("请使用 --help 查看用法");
  }

  process.exit(1);
}

/** CLI 主流程：解析 → 生成 → 打印结果 → 退出 */
export async function runCli(argv: string[] = process.argv.slice(2)) {
  try {
    const { input, help, version } = parseCliArgs(argv);

    if (help) {
      console.log(HELP_TEXT);
      process.exit(0);
    }

    if (version) {
      console.log(pkg.version);
      process.exit(0);
    }

    // 校验规则与 MCP 完全一致（normalizeCreateApiInput）
    const done = await runCreateApi(input);

    console.log(formatApiDoneText(done));
    process.exit(0);
  } catch (err) {
    exitWithError(err);
  }
}
