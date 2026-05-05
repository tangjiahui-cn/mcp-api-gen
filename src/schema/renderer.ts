import { ApiInfo } from "./apiInfo";
import { SchemaObject } from "./openapi";

export type RenderContextRefs = Record<string, SchemaObject>;

export type RenderContext = {
  apiInfo: ApiInfo;
  refs: RenderContextRefs;
};

/** API 渲染函数 */
export type ApiRenderType = (ctx: RenderContext) => string;

export type CreateApiRenderResult = {
  /** 所有 import 语句 */
  imports: string;

  /** API 函数之前的顶层代码（不包含 import） */
  prelude: string;

  /** API 渲染函数（api信息 -> api代码文本） */
  render: ApiRenderType;
};

/** 创建 API 渲染函数 */
export type CreateApiRenderType = () => Promise<CreateApiRenderResult>;

export type Model = {
  schema: SchemaObject;
  name: string;
};

export type PageRenderOptions = {
  /** 页面头部（常用于添加注释） */
  header?: string;

  /** 所有 import 语句 */
  imports: string;

  /** API 函数之前的顶层代码（不包含 import） */
  prelude: string;

  /** API 函数体代码 */
  apis: string;

  /** API 依赖数据结构 */
  models: Array<Model>;
};

/** API 页面渲染函数 */
export type PageRender = (options: PageRenderOptions) => string;
