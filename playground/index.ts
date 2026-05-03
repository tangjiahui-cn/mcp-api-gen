import express from "express";
import swaggerUi from "swagger-ui-express";

const app = express();
const port = 3000;

function createAPI(round: number) {
  const paths: Record<string, any> = {};

  for (let i = 1; i <= round; i++) {
    // 列表接口
    paths[`/api/module${i}/list`] = {
      get: {
        tags: ["Mock模块"],
        summary: `获取 module${i} 列表`,
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

    // 创建接口
    paths[`/api/module${i}/create`] = {
      post: {
        tags: ["Mock模块"],
        summary: `创建 module${i}`,
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

    // 删除接口
    paths[`/api/module${i}/delete/{id}`] = {
      delete: {
        tags: ["Mock模块"],
        summary: `删除 module${i}`,
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
      title: "Mock API",
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
          description: "通用返回结构",
          properties: {
            success: {
              type: "boolean",
              description: "请求是否成功",
            },
            message: {
              type: "string",
              description: "提示信息",
            },
            data: {
              description: "返回数据（结构不固定）",
              oneOf: [
                { $ref: "#/components/schemas/PageResponse" },
                { $ref: "#/components/schemas/User" },
                {
                  type: "array",
                  description: "列表结构",
                  items: {
                    $ref: "#/components/schemas/Item",
                  },
                },
              ],
            },
          },
        },

        PageResponse: {
          type: "object",
          description: "分页数据",
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
              description: "数据列表",
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
                description: "标签项",
              },
            },
            extra: {
              type: "object",
              description: "扩展字段",
              properties: {
                score: {
                  type: "number",
                  description: "评分",
                },
                remark: {
                  type: "string",
                  description: "备注",
                },
              },
            },
          },
        },

        Item: {
          type: "object",
          description: "树节点",
          properties: {
            id: {
              type: "string",
              description: "节点ID",
            },
            name: {
              type: "string",
              description: "节点名称",
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
          description: "部门",
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

        Mix: {
          description: "allOf 组合结构",
          allOf: [
            {
              type: "object",
              properties: {
                a: {
                  type: "string",
                  description: "字段A",
                },
              },
            },
            {
              type: "object",
              properties: {
                b: {
                  type: "number",
                  description: "字段B",
                },
              },
            },
          ],
        },
      },
    },
  };
}

// 1200 接口
const apiDoc = createAPI(400);

app.get("/api-docs.json", (_, res) => {
  res.json(apiDoc);
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(apiDoc));

app.listen(port, () => {
  console.log(`docs: http://localhost:${port}/docs`);
  console.log(`openapi: http://localhost:${port}/api-docs.json`);
});
