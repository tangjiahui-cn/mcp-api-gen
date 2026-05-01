import { BuildOptions, context, build } from "esbuild";
import pkg from "./package.json" with { type: "json" };

const isWatch = process.argv.includes("--watch");
const isDevelopment = process.env.mode === "development";
const config: BuildOptions = {
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",

  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",

  sourcemap: false,
  minify: !isDevelopment,

  logLevel: "info",

  // external 所有 node_modules
  external: [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ],

  alias: {
    "@": "./src",
  },
};

try {
  if (isWatch) {
    const ctx = await context(config);
    await ctx.watch();
    console.log("watching: src -> dist/index.js");
  } else {
    await build(config);
    console.log("build success: dist/index.js");
  }
} catch (err) {
  console.error("build failed", err);
  process.exit(1);
}
