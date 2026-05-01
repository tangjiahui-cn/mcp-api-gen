import { HttpMethod } from "@/types";

/**
 * API 信息结构（用于代码生成）
 */
export interface ApiInfo {
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

export type ApiInfoKey = keyof ApiInfo;
