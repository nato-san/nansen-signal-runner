import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { getAdminStatus, getRunData } from "./lib/runtime.mjs";

const root = fileURLToPath(new URL("./dist", import.meta.url));
const port = Number(process.env.PORT || 4173);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

async function serveStatic(request, response) {
  const requestPath = new URL(request.url, `http://${request.headers.host}`).pathname;
  const safePath = normalize(requestPath).replace(/^(\.\.(\/|\\|$))+/, "");
  let filePath = join(root, safePath === "/" ? "index.html" : safePath === "/admin" ? "admin.html" : safePath);
  try {
    await access(filePath);
    if ((await stat(filePath)).isDirectory()) filePath = join(filePath, "index.html");
  } catch {
    filePath = join(root, "index.html");
  }
  response.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream" });
  createReadStream(filePath).pipe(response);
}

createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/api/admin-status") {
    json(response, 200, getAdminStatus());
    return;
  }
  if (request.method === "GET" && request.url === "/api/run-data") {
    try {
      json(response, 200, await getRunData());
    } catch (error) {
      json(response, 503, { mode: "unavailable", message: error instanceof Error ? error.message : "Live prices unavailable" });
    }
    return;
  }
  if (request.method === "GET" || request.method === "HEAD") {
    await serveStatic(request, response);
    return;
  }
  json(response, 405, { message: "Method not allowed" });
}).listen(port, "127.0.0.1", () => {
  console.log(`Nansen Runner: http://127.0.0.1:${port}`);
  console.log(process.env.NANSEN_API_KEY ? "Live pricing enabled (10 minute cache)." : "Live pricing disabled: NANSEN_API_KEY is not set.");
});
