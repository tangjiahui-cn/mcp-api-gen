import { ApiSchemaInfo, OpenAPISpec, SchemaObject, Model } from "@/schema";
import { ApiRenderUnit } from "./generate";

const REF_REG = /^#\/(?:components\/schemas|definitions)\/([^/]+)$/;

function getSchemaNameFromRef(ref?: string): string | null {
  const m = ref && ref.match(REF_REG);
  return m ? m[1] : null;
}

/**
 * 按依赖顺序生成 model
 */
export function collectModels(
  apiList: ApiRenderUnit[],
  spec: OpenAPISpec,
): Model[] {
  const orderedNames: string[] = resolveSchemaNames(apiList, spec);

  return orderedNames
    .map((name) => {
      return {
        name,
        schema: spec?.components?.schemas?.[name],
      };
    })
    .filter((model) => model.schema) as Model[];
}

function getSchemas(spec: OpenAPISpec) {
  return spec.components?.schemas || spec.definitions || {};
}

/**
 * 按依赖顺序生成 schemaNames
 */
export function resolveSchemaNames(
  apiList: ApiRenderUnit[],
  spec: OpenAPISpec,
): string[] {
  const schemas = getSchemas(spec);

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const result: string[] = [];

  // 按依赖顺序解析 schema
  function visit(name: string) {
    // 避免循环依赖
    if (!name || visited.has(name) || visiting.has(name)) return;

    const schema = schemas[name];
    if (!schema) return;

    visiting.add(name);

    extractSchemaRefs(schema).forEach((dep) => {
      if (schemas[dep]) visit(dep);
    });

    visiting.delete(name);
    visited.add(name);
    result.push(name);
  }

  // 收集入口依赖
  function collect(entry?: ApiSchemaInfo) {
    if (!entry) return;

    // $ref 形式
    const ref = getSchemaNameFromRef(entry.ref);
    if (ref) visit(ref);

    // schema 形式 （array、object等）
    if (entry.schema) {
      extractSchemaRefs(entry.schema).forEach(visit);
    }
  }

  // 收集所有 API 依赖
  apiList.forEach(({ apiInfo }) => {
    collect(apiInfo.request?.body);
    collect(apiInfo.response);
  });

  return result;
}

/**
 * 提取 schema 依赖
 */
function extractSchemaRefs(schema: SchemaObject): string[] {
  const deps = new Set<string>();

  const walk = (s?: SchemaObject) => {
    if (!s) return;

    const ref = getSchemaNameFromRef(s.$ref);
    if (ref) return deps.add(ref);

    if (s.type === "array") return walk(s.items);

    if (s.type === "object") {
      Object.values(s.properties || {}).forEach(walk);
    }

    s.allOf?.forEach(walk);
    s.oneOf?.forEach(walk);
    s.anyOf?.forEach(walk);
  };

  walk(schema);
  return [...deps];
}
