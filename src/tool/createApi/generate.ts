import {
  ApiInfo,
  ApiSchemaInfo,
  OpenApiOperationObject,
  OpenApiParameter,
  OpenAPISpec,
  SchemaObject,
} from "@/schema";
import { formatComment, toCamelCase } from "@/share";
import {
  ApiRenderType,
  Model,
  RenderContextRefs,
} from "@/tool/createApi/renderer";
import { normalizeMethod } from "@/tool/createApi/normalize";
import { HttpMethod } from "@/types";
import { buildRequestType, buildSchemaType, toTsType } from "./parserSchema";

/**
 * 根据接口路径生成函数名（驼峰命名、忽略 /api）
 *
 * 示例：
 * '/api/user/list'                -> 'userList'
 * '/api/user/detail/{id}'         -> 'userDetailById'
 * '/api/dept/push/config/list'    -> 'pushConfigList'
 * '/api/user/delete' (delete)     -> 'deleteUserDelete'   // 避免关键字冲突
 * '/api/export' (post)            -> 'postExport'         // 避免关键字冲突
 */
export function generateName(method: string, apiPath: string) {
  // 将 {id} 转为 ById，避免函数名语义丢失
  let segments = apiPath
    .replace(/\{(\w+)\}/g, "By_$1")
    .split("/")
    .filter(Boolean)
    // 去掉通用前缀 api
    .filter((s) => s.toLowerCase() !== "api");

  // 控制函数名长度，仅取末尾 3 段
  segments = segments.slice(-3);

  // 转驼峰
  let name = segments.map((s, i) => toCamelCase(s, i === 0)).join("");

  // 避免 JS 关键字冲突
  const reserved = new Set([
    "delete",
    "export",
    "import",
    "default",
    "function",
    "class",
  ]);

  if (!name || reserved.has(name)) {
    name = method + name.charAt(0).toUpperCase() + name.slice(1);
  }

  return name;
}

export type ApiRenderUnit = {
  code: string;
  apiInfo: ApiInfo;
};

export type GenerateApiResultReturn = {
  apiList: Array<ApiRenderUnit>;
  stats: {
    totalCount: number;
  };
};

/**
 * 生成全部 API 的处理结果
 */
export function generateApiResult(
  spec: OpenAPISpec,
  render: ApiRenderType,
): GenerateApiResultReturn {
  let totalCount = 0;

  const apiList: ApiRenderUnit[] = [];
  const refs = spec.components?.schemas || spec.definitions || {};

  for (const [apiPath, methods] of Object.entries(spec.paths || {})) {
    for (const [method, op] of Object.entries(methods || {})) {
      const m = normalizeMethod(method);
      if (!m) continue;

      const apiInfo = createApiInfo({
        method: m,
        apiPath,
        op,
        spec,
      });

      const code = render({
        apiInfo,
        refs,
      });

      apiList.push({
        code,
        apiInfo,
      });

      totalCount++;
    }
  }

  return {
    apiList,
    stats: {
      totalCount,
    },
  };
}

/**
 * 创建 apiInfo
 */
export function createApiInfo(options: {
  method: HttpMethod;
  apiPath: string;
  op: OpenApiOperationObject;
  spec: OpenAPISpec;
}): ApiInfo {
  const { method, apiPath, op } = options;
  const params = op.parameters || [];

  const pathParams = params.filter((p) => p.in === "path");
  const queryParams = params.filter((p) => p.in === "query");

  const body = resolveRequestBody(op, params);
  const response = resolveResponse(op);

  return {
    name: generateName(method, apiPath),
    method,
    path: apiPath,
    summary: op.summary || "",
    request: {
      path: pathParams,
      query: queryParams,
      body,
    },
    response,
  };
}

/**
 * 解析 requestBody（兼容 OpenAPI3 / Swagger2）
 */
function resolveRequestBody(
  op: OpenApiOperationObject,
  params: OpenApiParameter[],
): ApiInfo["request"]["body"] | undefined {
  // OpenAPI3
  const content = op.requestBody?.content;
  if (content) {
    const schema =
      content["application/json"]?.schema ?? Object.values(content)[0]?.schema;

    return normalizeSchema(schema);
  }

  // Swagger2
  const bodyParam = params.find((p) => p.in === "body");
  return normalizeSchema(bodyParam?.schema);
}

/**
 * 解析 response（优先 200 / 201）
 */
function resolveResponse(op: OpenApiOperationObject): ApiSchemaInfo {
  const responses = op.responses || op.responsesObject;
  if (!responses) return {};

  const res =
    responses["200"] || responses["201"] || Object.values(responses)[0];

  if (!res) return {};

  // OpenAPI3
  if (res.content) {
    const schema =
      res.content["application/json"]?.schema ??
      Object.values(res.content)[0]?.schema;

    return normalizeSchema(schema) || {};
  }

  // Swagger2
  return normalizeSchema(res.schema) || {};
}

/**
 * 标准化 schema
 */
function normalizeSchema(schema?: SchemaObject): ApiSchemaInfo | undefined {
  if (!schema) return;

  return schema.$ref ? { ref: schema.$ref } : { schema };
}

/** TypeScript 类型的接口信息 */
export interface TsApiInfo {
  /** 函数名称 */
  name: string;

  /** 请求方式 */
  method: HttpMethod;

  /** 接口地址 */
  url: string;

  /** 参数变量名 */
  paramsName: string;

  /** 参数承载方式 */
  paramsType: "params" | "data";

  /** 入参类型 */
  requestType?: string;

  /** 返回类型 */
  responseType?: string;

  /** 注释 */
  summary?: string;
}

/**
 * 创建 TsApiInfo（仅做结构 → TS 表达转换）
 */
export function createTsApiInfo(
  apiInfo: ApiInfo,
  refs: RenderContextRefs,
  options?: {
    inline?: boolean;
  },
): TsApiInfo {
  const { method, path, request, response, summary, name } = apiInfo;
  const inline = options?.inline;

  const paramsName = method === "get" ? "params" : "data";
  const paramsType = paramsName;

  const url = path.replace(/\{(\w+)\}/g, (_, key) => {
    return `\${${paramsName}.${key} ?? ""}`;
  });

  const requestType = buildRequestType(request, refs, { inline });
  const responseType = buildSchemaType(response, refs, { inline });

  return {
    name,
    method,
    url,
    paramsName,
    paramsType,
    requestType,
    responseType,
    summary,
  };
}

/**
 * 生成 TS 类型代码
 * @param models 带名字 schema 列表
 */
export function generateTsTypes(models: Array<Model>): string {
  const refs = Object.fromEntries(
    models.map(({ name, schema }) => [name, schema]),
  );

  // allOf / oneOf 类型，即 & 或 |
  const ALL_ONE_REG = /[&|]/;

  return models
    .map(({ name, schema }) => {
      const type = toTsType(schema, refs, new Set(), {
        inline: false,
      });

      const comment = formatComment(schema.description);

      if (
        schema.type === "object" &&
        type.trim().startsWith("{") && // 必须是对象
        !ALL_ONE_REG.test(type) // 不能是 allOf、oneOf
      ) {
        return `${comment}\nexport interface ${name} ${type}`;
      }

      return `${comment}\nexport type ${name} = ${type};`;
    })
    .join("\n\n");
}
