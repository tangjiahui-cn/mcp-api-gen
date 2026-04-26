/**
 * 模拟创建 openapi json文件
 */
import * as fs from "fs";

const paths = {};
const round = 400; // 1200 接口 (400 * 3)

function createAPI(round) {
  for (let i = 1; i <= round; i++) {
    // list
    paths[`/api/module${i}/list`] = {
      get: {
        tags: ["Mock模块"],
        summary: `列表${i}`,
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "number" },
          },
          {
            name: "size",
            in: "query",
            schema: { type: "number" },
          },
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

    // create
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

    // delete
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
        url: "http://localhost:3000",
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

fs.writeFileSync("./api-docs.json", JSON.stringify(createAPI(round), null, 2));
