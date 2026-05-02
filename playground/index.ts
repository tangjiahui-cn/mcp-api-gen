import express from "express";
import swaggerUi from "swagger-ui-express";

const app = express();
const port = 3000;

/**
 * 构造 OpenAPI 文档
 */
function createAPI(round: number) {
  const paths: Record<string, any> = {};

  for (let i = 1; i <= round; i++) {
    // list 接口
    paths[`/api/module${i}/list`] = {
      get: {
        tags: ["Mock模块"],
        summary: `列表${i}`,
        parameters: [
          { name: "page", in: "query", schema: { type: "number" } },
          { name: "size", in: "query", schema: { type: "number" } },
        ],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PageResponse" },
              },
            },
          },
        },
      },
    };

    // create 接口
    paths[`/api/module${i}/create`] = {
      post: {
        tags: ["Mock模块"],
        summary: `创建${i}`,
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateDTO" },
            },
          },
        },
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BaseResponse" },
              },
            },
          },
        },
      },
    };

    // delete 接口
    paths[`/api/module${i}/delete/{id}`] = {
      delete: {
        tags: ["Mock模块"],
        summary: `删除${i}`,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BaseResponse" },
              },
            },
          },
        },
      },
    };
  }

  return {
    openapi: "3.0.1",
    info: {
      title: "Mock Bulk API",
      version: "1.0.0",
    },
    servers: [
      {
        url: `http://localhost:${port}`,
      },
    ],
    paths,
    components: {
      schemas: {
        BaseResponse: {
          type: "object",
          properties: {
            success: { type: "boolean" },
          },
        },
        CreateDTO: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
        },
        PageResponse: {
          type: "object",
          properties: {
            list: {
              type: "array",
              items: { $ref: "#/components/schemas/Item" },
            },
          },
        },
        Item: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
          },
        },
      },
    },
  };
}

// 初始化文档（默认 1200 接口）
let apiDoc = createAPI(400);

/**
 * 提供 OpenAPI JSON
 */
app.get("/api-docs.json", (req, res) => {
  const round = Number(req.query.round || 400);
  res.json(createAPI(round));
});

/**
 * Swagger UI
 */
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(apiDoc, {
    explorer: true,
  }),
);

/**
 * 启动服务
 */
app.listen(port, () => {
  console.log(`docs: http://localhost:${port}/docs`);
  console.log(`openapi: http://localhost:${port}/api-docs.json`);
});