/**
 * 实例解析器返回结果
 */
export interface ExampleParseResult {
  /** 所有 import 语句 */
  imports: string;

  /** API 函数之前的顶层代码（不包含 import） */
  prelude: string;

  /** API 函数模板（包含 {{占位符}}） */
  template: string;
}

/**
 * 实例解析函数
 */
export type ExampleParser = (code?: string) => Promise<ExampleParseResult>;
