import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { serveDir } from "https://deno.land/std@0.220.0/http/file_server.ts";
import { transform } from "https://esm.sh/esbuild@0.21.5";

const PORT = 3002;

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  let pathname = url.pathname;

  // Handle root path - serve index.html
  if (pathname === "/") {
    pathname = "/index.html";
  }

  // Handle TypeScript files
  if (pathname.endsWith(".tsx") || pathname.endsWith(".ts")) {
    try {
      const fileContent = await Deno.readTextFile(`.${pathname}`);
      
      // Use esbuild to transform TypeScript/JSX to JavaScript
      const result = await transform(fileContent, {
        loader: pathname.endsWith(".tsx") ? "tsx" : "ts",
        target: "es2020",
        format: "esm",
      });
      
      return new Response(result.code, {
        headers: {
          "Content-Type": "application/javascript",
        },
      });
    } catch (error) {
      return new Response(`Error: ${error.message}`, {
        status: 500,
      });
    }
  }

  // Handle HTML files
  if (pathname.endsWith(".html")) {
    try {
      const fileContent = await Deno.readTextFile(`.${pathname}`);
      return new Response(fileContent, {
        headers: {
          "Content-Type": "text/html",
        },
      });
    } catch (error) {
      return new Response(`Error: ${error.message}`, {
        status: 404,
      });
    }
  }

  // Handle other files
  return serveDir(request, {
    fsRoot: ".",
    urlRoot: "/",
    showDirListing: true,
    enableCors: true,
  });
}

console.log(`Dev server running on http://localhost:${PORT}`);
serve(handleRequest, { port: PORT });