import { OpenAPISpec, SchemaObject } from "@/schema";
import { ApiRenderUnit } from "./generate";
import { Model } from "./renderer";

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

  const dfs = (name: string) => {
    if (!name || visited.has(name) || visiting.has(name)) return;

    const schema = schemas[name];
    if (!schema) return;

    visiting.add(name);

    for (const dep of extractSchemaRefs(schema)) {
      if (schemas[dep]) dfs(dep);
    }

    visiting.delete(name);
    visited.add(name);
    result.push(name);
  };

  for (const { apiInfo } of apiList) {
    const refs = [
      getSchemaNameFromRef(apiInfo.request?.body?.ref),
      getSchemaNameFromRef(apiInfo.response?.ref),
    ];

    refs.forEach((r) => r && dfs(r));
  }

  return result;
}

/**
 * 提取 schema 依赖
 */
function extractSchemaRefs(schema: SchemaObject): string[] {
  const deps = new Set<string>();

  const walk = (s?: SchemaObject) => {
    if (!s) return;

    const ref = getSchemaNameFromRef((s as any).$ref);
    if (ref) return deps.add(ref);

    if (s.type === "array") return walk(s.items);

    if (s.type === "object") {
      Object.values(s.properties || {}).forEach(walk);
    }

    (s as any).allOf?.forEach(walk);
    (s as any).oneOf?.forEach(walk);
    (s as any).anyOf?.forEach(walk);
  };

  walk(schema);
  return [...deps];
}
