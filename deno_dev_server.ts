import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { serveDir } from "https://deno.land/std@0.220.0/http/file_server.ts";
import * as esbuild from "https://deno.land/x/esbuild@v0.21.5/mod.js";

const PORT = 3000;
const ROOT_DIR = ".";

// 初始化 esbuild
await esbuild.initialize({
  wasmURL: "https://esbuild.github.io/demo/esbuild.wasm",
});

// 编译 TypeScript/JSX 文件
async function compileTSX(content: string, filePath: string): Promise<string> {
  try {
    const result = await esbuild.transform(content, {
      loader: filePath.endsWith(".tsx") ? "tsx" : "ts",
      target: "es2020",
      format: "esm",
      jsx: "automatic",
      jsxImportSource: "react",
    });
    return result.code;
  } catch (error) {
    console.error(`编译错误 ${filePath}:`, error);
    throw error;
  }
}

// 处理请求
async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  console.log(`${req.method} ${path}`);

  // 处理根路径，返回 index.html
  if (path === "/") {
    return new Response(
      await Deno.readTextFile(`${ROOT_DIR}/index.html`),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // 处理 TypeScript/JSX 文件
  if (path.endsWith(".tsx") || path.endsWith(".ts")) {
    try {
      const content = await Deno.readTextFile(`${ROOT_DIR}${path}`);
      const compiled = await compileTSX(content, path);
      return new Response(compiled, {
        headers: { "Content-Type": "application/javascript" },
      });
    } catch (error) {
      return new Response(`编译错误: ${error.message}`, { status: 500 });
    }
  }

  // 处理其他文件
  return serveDir(req, {
    fsRoot: ROOT_DIR,
    urlRoot: "/",
    enableCors: true,
  });
}

// 启动服务器
console.log(`🚀 开发服务器启动在 http://localhost:${PORT}`);
console.log(`📁 根目录: ${ROOT_DIR}`);
console.log(`🔧 支持 TypeScript/JSX 实时编译`);

serve(handleRequest, { port: PORT });

// 关闭时清理 esbuild
Deno.addSignalListener("SIGINT", () => {
  esbuild.dispose();
  Deno.exit();
});
