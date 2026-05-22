/**
 * 测试 createApi Service
 *
 * 说明：
 * （1）运行测试 API 生成流程
 */
import path from "path";
// import { createApiService } from "./dist";
import { createApiService } from "./src";

const projectRoot = path.resolve();
const output = path.resolve("./dist-debug/api.ts");

const MOCK_CURRENT_ROOT = {
  openapiUrl: "http://localhost:3000/api-docs.json",
  projectRoot,
  output,
};

const MOCK_INPUT = {
  openapiUrl: "http://localhost:3000/api-docs.json",
  projectRoot,
  output,
  example:
    "import request from 'axios';  /**\n * 查询列表\n */\nexport function queryList(params: QueryListParams): Promise<QueryListResponse> {\n  return request.get('/api/list', { params })\n}",
};

// 该实例会触发报错（多个示例）
const MOCK_MULTIPLE = {
  openapiUrl: "http://localhost:3000/api-docs.json",
  projectRoot,
  output,
  example:
    "import request from 'axios';\n\nexport function getUser(params: { id: number }) {\n  return request.get(`/api/user/${params.id}`, { params })\n}\n\nexport function createUser(data: any) {\n  return request.post(`/api/user`, { data })\n}",
};

const MOCK_NO_PARAMS = {
  openapiUrl: "http://localhost:3000/api-docs.json",
  projectRoot,
  output,
  example:
    "import request from 'axios';\n\nexport function getUserById(params: { id: number }) {\n  return request.get(`/api/user/${params.id}`)\n}",
  // "import request from 'axios';\n\nexport function getUserById(params: { id: number }) {\n  return request.get(`/api/user/${params.id}`, {})\n}",
};

const MOCK_PREFIX_INPUT = {
  example:
    "import axios from 'axios'; \n \n const request = axios; \n const prefix = '/xxx/api'; \n \n export function getUserById(params: { id: number }) { \n   return request.get(`${prefix}/user/${params.id}`, { params }) \n }",
  // "import axios from 'axios'; \n \n const request = axios; \n const prefix = '/xxx/api'; \n \n export function getUserById(params: { id: number }) { \n   return request.get(`/user/${params.id}`, { params }) \n }",
  // "import axios from 'axios'; \n \n const request = axios; \n const prefix = '/xxx/api'; \n \n export function getUserById(params: { id: number }) { \n   return request.get(`/user/id`, { params }) \n }",
  openapiUrl: "http://localhost:3000/api-docs.json",
  output,
  projectRoot,
};

const _PARAMS = {
  example: MOCK_NO_PARAMS.example,
  openapiUrl: "http://172.16.11.91:8082/v2/api-docs?group=deptConfig",
  output,
  projectRoot,
};

(async () => {
  const input = _PARAMS as any;
  const info = await createApiService(input);
  console.log("生成信息：", info);
  console.log("生成成功：" + path.resolve(input.projectRoot, input.output));
})();
