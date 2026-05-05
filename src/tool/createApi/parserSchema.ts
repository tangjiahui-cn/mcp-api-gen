import {
  ApiInfo,
  ApiSchemaInfo,
  SchemaObject,
  RenderContextRefs,
} from "@/schema";

/**
 * 请求参数转为 TypeScript 类型
 */
export function buildRequestType(
  request: ApiInfo["request"],
  refs: RenderContextRefs,
  options?: { inline?: boolean },
): string | undefined {
  const { body, path, query } = request;

  if (body) {
    return buildSchemaType(body, refs, options);
  }

  const params = [...(path || []), ...(query || [])];
  if (!params.length) return "any";

  const lines = params.map((p) => {
    const optional = p.required ? "" : "?";
    const type = p.schema
      ? buildSchemaType({ schema: p.schema }, refs)
      : mapPrimitive(p.type);

    const comment = p.description ? `  /** ${p.description} */\n` : "";

    return `${comment}  ${p.name}${optional}: ${type}`;
  });

  return `{\n${lines.join(",\n")}\n}`;
}

/**
 * schema / ref 转为 TypeScript 类型
 */
export function buildSchemaType(
  schemaInfo?: ApiSchemaInfo,
  refs?: RenderContextRefs,
  options?: { inline?: boolean },
): string {
  if (!schemaInfo) return "any";

  // ref
  if (schemaInfo.ref) {
    const key = getRefKey(schemaInfo.ref);

    // 引用模式
    if (!options?.inline) {
      return key;
    }

    const schema = resolveRefSchema(schemaInfo.ref, refs);
    if (!schema) return "any";

    // 内联模式
    return toTsType(schema, refs, new Set(), options);
  }

  // inline schema
  if (schemaInfo.schema) {
    return toTsType(schemaInfo.schema, refs);
  }

  return "any";
}

function resolveUnionItem(
  item: any,
  refs?: RenderContextRefs,
  visited?: Set<string>,
  options?: { inline?: boolean },
) {
  if (item.$ref) {
    return options?.inline
      ? toTsType(item, refs, visited, options)
      : getRefKey(item.$ref);
  }

  return toTsType(item, refs, visited, options);
}

const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * schema 生成 TypeScript 类型
 */
export function toTsType(
  schema: SchemaObject,
  refs?: RenderContextRefs,
  visited = new Set<string>(),
  options?: { inline?: boolean },
): string {
  if (!schema) return "any";

  // enum
  if (schema.enum) {
    const raw = schema.enum;
    const hasNull = raw.includes(null);

    const values = raw.map((v) => {
      if (typeof v === "string") return `"${v}"`;
      if (v === null) return "null";
      return String(v);
    });

    const result = values.join(" | ");

    if (schema.nullable && !hasNull) {
      return `(${result}) | null`;
    }

    return result;
  }

  // oneOf / anyOf
  if (schema.oneOf || schema.anyOf) {
    const list = schema.oneOf || schema.anyOf || [];

    if (!list.length) return "any";

    const result = Array.from(
      new Map(
        list.map((item: any) => {
          const type = resolveUnionItem(item, refs, new Set(visited), options);
          return [normalize(type), type];
        }),
      ).values(),
    ).join(" | ");

    const wrapped = `(${result})`;
    return schema.nullable ? `${wrapped} | null` : wrapped;
  }

  // allOf
  if (schema.allOf) {
    if (!schema.allOf.length) return "any";

    const result = schema.allOf
      .map((item: any) =>
        resolveUnionItem(item, refs, new Set(visited), options),
      )
      .join(" & ");

    const wrapped = `(${result})`;
    return schema.nullable ? `${wrapped} | null` : wrapped;
  }

  // $ref
  if ((schema as any).$ref) {
    const key = getRefKey((schema as any).$ref);

    if (!options?.inline) {
      return schema.nullable ? `(${key}) | null` : key;
    }

    if (visited.has(key)) {
      return "any";
    }

    const next = new Set(visited);
    next.add(key);

    const refSchema = resolveRefSchema((schema as any).$ref, refs);
    const result = refSchema ? toTsType(refSchema, refs, next, options) : "any";

    return schema.nullable ? `(${result}) | null` : result;
  }

  // array
  if (schema.type === "array" && schema.items) {
    const result = `${toTsType(
      schema.items,
      refs,
      new Set(visited),
      options,
    )}[]`;

    return schema.nullable ? `(${result}) | null` : result;
  }

  // object
  if (schema.type === "object") {
    if (!schema.properties) {
      const result = "Record<string, any>";
      return schema.nullable ? `(${result}) | null` : result;
    }

    const lines = Object.entries(schema.properties).map(([k, v]) => {
      const optional = schema.required?.includes(k) ? "" : "?";
      const comment = v.description ? `  /** ${v.description} */\n` : "";

      return `${comment}  ${k}${optional}: ${toTsType(
        v,
        refs,
        new Set(visited),
        options,
      )};`;
    });

    const result = `{\n${lines.join("\n")}\n}`;
    return schema.nullable ? `(${result}) | null` : result;
  }

  // primitive
  const result = mapPrimitive(schema.type) || "any";
  return schema.nullable ? `(${result}) | null` : result;
}

const primitiveMap: Record<string, string> = {
  string: "string",
  integer: "number",
  number: "number",
  boolean: "boolean",
};

/**
 * OpenAPI 基础类型转成 TypeScript 类型
 */
export function mapPrimitive(type?: string): string {
  return primitiveMap[type || ""] || "any";
}

export function getRefKey(ref?: string): string {
  return ref?.split("/").pop() || "any";
}

/**
 * 根据 $ref 找到对应 schema
 */
export function resolveRefSchema(
  ref: string,
  refs?: RenderContextRefs,
): SchemaObject | undefined {
  if (!refs) return;

  const key = getRefKey(ref);
  return refs[key];
}
