import express from "express";
import swaggerUi from "swagger-ui-express";

const app = express();
const port = 3000;

function createAPI(round: number) {
  const paths: Record<string, any> = {};

  for (let i = 1; i <= round; i++) {
    paths[`/api/module${i}/list`] = {
      get: {
        tags: ["Mock模块"],
        summary: `列表${i}`,
        description: `获取 module${i} 列表`,
        parameters: [
          {
            name: "page",
            in: "query",
            description: "页码",
            schema: { type: "number" },
          },
          {
            name: "size",
            in: "query",
            description: "每页数量",
            schema: { type: "number" },
          },
        ],
        responses: {
          200: {
            description: "成功返回",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/BaseResponse",
                },
              },
            },
          },
        },
      },
    };

    paths[`/api/module${i}/create`] = {
      post: {
        tags: ["Mock模块"],
        summary: `创建${i}`,
        description: `创建 module${i}`,
        requestBody: {
          required: true,
          description: "创建参数",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CreateDTO",
              },
            },
          },
        },
        responses: {
          200: {
            description: "创建成功",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/BaseResponse",
                },
              },
            },
          },
        },
      },
    };

    paths[`/api/module${i}/delete/{id}`] = {
      delete: {
        tags: ["Mock模块"],
        summary: `删除${i}`,
        description: `删除 module${i}`,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "资源ID",
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "删除成功",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/BaseResponse",
                },
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
      description: "批量生成接口（支持复杂 schema / 循环引用）",
      version: "1.0.0",
    },
    servers: [
      {
        url: `http://localhost:${port}`,
        description: "本地服务",
      },
    ],
    paths,
    components: {
      schemas: {
        BaseResponse: {
          type: "object",
          description: "通用响应结构",
          properties: {
            success: {
              type: "boolean",
              description: "是否成功",
            },
            message: {
              type: "string",
              description: "提示信息",
            },
            data: {
              description: "返回数据",
              oneOf: [
                { $ref: "#/components/schemas/PageResponse" },
                { $ref: "#/components/schemas/Item" },
                { $ref: "#/components/schemas/User" },
              ],
            },
          },
        },

        PageResponse: {
          type: "object",
          description: "分页结果",
          properties: {
            total: {
              type: "number",
              description: "总条数",
            },
            page: {
              type: "number",
              description: "当前页",
            },
            size: {
              type: "number",
              description: "每页数量",
            },
            list: {
              type: "array",
              description: "列表数据",
              items: {
                $ref: "#/components/schemas/Item",
              },
            },
          },
        },

        CreateDTO: {
          type: "object",
          description: "创建请求参数",
          required: ["name"],
          properties: {
            name: {
              type: "string",
              description: "名称",
            },
            status: {
              type: "string",
              description: "状态",
              enum: ["enable", "disable"],
            },
            tags: {
              type: "array",
              description: "标签列表",
              items: {
                type: "string",
                description: "标签",
              },
            },
            extra: {
              type: "object",
              description: "扩展信息",
              properties: {
                remark: {
                  type: "string",
                  description: "备注",
                },
                score: {
                  type: "number",
                  description: "评分",
                },
              },
            },
          },
        },

        Item: {
          type: "object",
          description: "树节点（递归结构）",
          properties: {
            id: {
              type: "string",
              description: "ID",
            },
            name: {
              type: "string",
              description: "名称",
            },
            children: {
              type: "array",
              description: "子节点",
              items: {
                $ref: "#/components/schemas/Item",
              },
            },
          },
        },

        User: {
          type: "object",
          description: "用户",
          properties: {
            id: {
              type: "string",
              description: "用户ID",
            },
            name: {
              type: "string",
              description: "用户名",
            },
            dept: {
              description: "所属部门",
              $ref: "#/components/schemas/Department",
            },
          },
        },

        Department: {
          type: "object",
          description: "部门（包含用户，循环引用）",
          properties: {
            id: {
              type: "string",
              description: "部门ID",
            },
            name: {
              type: "string",
              description: "部门名称",
            },
            users: {
              type: "array",
              description: "部门成员",
              items: {
                $ref: "#/components/schemas/User",
              },
            },
          },
        },
      },
    },
  };
}

let apiDoc = createAPI(400);

app.get("/api-docs.json", (_, res) => {
  res.json(apiDoc);
});

app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(apiDoc, {
    explorer: true,
  }),
);

app.listen(port, () => {
  console.log(`docs: http://localhost:${port}/docs`);
  console.log(`openapi: http://localhost:${port}/api-docs.json`);
});
