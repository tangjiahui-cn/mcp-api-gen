/**
 * Schema 节点定义（用于描述请求/响应的数据结构）
 */
export type SchemaObject = {
  /** 当前节点的数据类型（string / number / object / array 等） */
  type?: string;

  /** 字段描述（通常来自接口文档，用于生成注释） */
  description?: string;

  /** 对象类型的属性集合（key -> 子 Schema） */
  properties?: Record<string, SchemaObject>;

  /** 数组元素的类型定义（当 type 为 array 时生效） */
  items?: SchemaObject;

  /** 必填字段列表（用于区分可选/必选） */
  required?: string[];

  /** 引用其他 Schema（如 #/components/schemas/User） */
  $ref?: string;

  /** 枚举 */
  enum?: (string | number | boolean | null)[];
};

/**
 * OpenAPI 文档结构（兼容 Swagger2 / OpenAPI3）
 */
export type OpenAPISpec = {
  /**
   * 接口路径定义
   * key: /api/user/list
   * value: { get: {...}, post: {...} }
   */
  paths?: Record<string, Record<string, any>>;

  /** Swagger2 的模型定义（旧版本字段） */
  definitions?: Record<string, SchemaObject>;

  /** OpenAPI3 的组件定义（推荐使用） */
  components?: {
    /** schema 模型定义集合 */
    schemas?: Record<string, SchemaObject>;
  };
};

/**
 * OpenAPI 单个接口方法定义
 *
 * 对应结构：
 * spec.paths['/api/user/list']['get'] -> OpenApiOperationObject
 */
export type OpenApiOperationObject = {
  /** 接口摘要，用于生成函数注释 */
  summary?: string;

  /** OpenAPI3 请求体定义 */
  requestBody?: {
    /** 不同 content-type 下的请求体结构 */
    content?: {
      [contentType: string]: {
        /** 请求体 schema */
        schema?: SchemaObject;
      };
    };
  };

  /** Swagger2 / OpenAPI 通用参数定义 */
  parameters?: Array<{
    /** 参数名称 */
    name: string;

    /** 参数位置：query / path / body / header */
    in: "query" | "path" | "body" | "header";

    /** 是否必填 */
    required?: boolean;

    /** Swagger2 参数类型 */
    type?: string;

    /** 参数 schema，常用于 body 参数或 OpenAPI3 参数 */
    schema?: SchemaObject;
  }>;

  /** 标准 responses 定义 */
  responses?: Record<
    string,
    {
      /** Swagger2 响应 schema */
      schema?: SchemaObject;

      /** OpenAPI3 响应内容定义 */
      content?: {
        [contentType: string]: {
          /** 响应体 schema */
          schema?: SchemaObject;
        };
      };
    }
  >;

  /** 兼容部分文档工具生成的 responsesObject 字段 */
  responsesObject?: Record<
    string,
    {
      /** Swagger2 响应 schema */
      schema?: SchemaObject;

      /** OpenAPI3 响应内容定义 */
      content?: {
        [contentType: string]: {
          /** 响应体 schema */
          schema?: SchemaObject;
        };
      };
    }
  >;
};
