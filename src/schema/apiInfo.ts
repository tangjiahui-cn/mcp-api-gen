import { HttpMethod } from "@/types";
import { OpenApiParameter, SchemaObject } from "@/schema/openapi";

/**
 * schema 信息 ($ref和内联存在其一)
 */
export type ApiSchemaInfo = {
  /** $ref 引用 */
  ref?: string;

  /** 内联定义 */
  schema?: SchemaObject;
};

/**
 * API 信息
 */
export interface ApiInfo {
  /** 函数名称 */
  name: string;

  /** 请求方式 */
  method: HttpMethod;

  /** 原始路径 */
  path: string;

  /** 接口描述（注释） */
  summary?: string;

  /** 请求数据 */
  request: {
    /** path 参数 */
    path: OpenApiParameter[];

    /** query 参数 */
    query: OpenApiParameter[];

    /** body（POST / PUT） */
    body?: ApiSchemaInfo;
  };

  /** 返回数据 */
  response: ApiSchemaInfo;
}

/**
 * API 信息 key
 */
export type ApiInfoKey = keyof ApiInfo;
