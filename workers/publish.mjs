import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const worker = "/workers/scripts/nowx";
const output = resolve(".cloudflare/output/v1/workers/default");
const assets = join(output, "assets");
const config = JSON.parse(await readFile(join(output, "worker.config.json"), "utf8"));
if (config.name !== "nowx") throw new Error("构建产物不属于 NowX");

async function api(path, { body, auth = token } = {}) {
  const multipart = body instanceof FormData;
  const response = await fetch("https://api.cloudflare.com/client/v4/accounts/" + account + path, {
    method: body ? "POST" : "GET",
    headers: { Authorization: "Bearer " + auth, ...(body && !multipart && { "Content-Type": "application/json" }) },
    body: multipart ? body : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    // 公共日志只显示状态码和 API 错误编号。
    throw new Error("Cloudflare HTTP " + response.status + " / " + (data.errors ?? []).map((e) => e.code).join(","));
  }
  return data.result;
}

async function uploadAssets() {
  const files = execFileSync(
    "git",
    [
      "ls-files",
      "-z",
      "--others",
      "--exclude-from=" + join(assets, ".assetsignore"),
      "--exclude=.assetsignore",
      "--exclude=_headers",
      "--exclude=_redirects",
      "--",
      ".",
    ],
    { cwd: assets, encoding: "utf8" },
  );
  const manifest = Object.create(null);
  const contents = new Map();
  for (const path of files.split("\0").filter(Boolean)) {
    const bytes = await readFile(join(assets, path));
    const base64 = bytes.toString("base64");
    const hash = createHash("sha256")
      .update(base64 + extname(path).slice(1))
      .digest("hex")
      .slice(0, 32);
    manifest["/" + path] = { hash, size: bytes.length };
    contents.set(hash, { path, base64 });
  }
  if (!contents.size) throw new Error("缺少构建静态资源");
  const session = await api(worker + "/assets-upload-session", { body: { manifest } });
  let jwt = session.buckets.length ? undefined : session.jwt;
  for (const bucket of session.buckets) {
    const form = new FormData();
    for (const hash of bucket) {
      const { path, base64 } = contents.get(hash);
      const type = execFileSync("file", ["--brief", "--mime-type", join(assets, path)], { encoding: "utf8" }).trim();
      const webTypes = {
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".wasm": "application/wasm",
        ".svg": "image/svg+xml",
        ".woff2": "font/woff2",
      };
      form.append(hash, new Blob([base64], { type: webTypes[extname(path)] ?? type }), hash);
    }
    const batch = await api("/workers/assets/upload?base64=true", { auth: session.jwt, body: form });
    if (batch.jwt) jwt = batch.jwt;
  }
  if (!jwt) throw new Error("静态资源上传未完成");
  return jwt;
}

async function latest() {
  return (await api(worker + "/versions")).items[0].id;
}
const version = (id) => api(worker + "/versions/" + id);
const sortBindings = (bindings) => [...bindings].sort((a, b) => a.name.localeCompare(b.name));

const form = new FormData();
const bundle = join(output, "bundle");
const moduleTypes = {
  esm: "application/javascript+module",
  wasm: "application/wasm",
  text: "text/plain",
  json: "text/plain",
  data: "application/octet-stream",
  cjs: "application/javascript",
};
for (const entry of await readdir(bundle, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const file = join(entry.parentPath, entry.name);
  const path = relative(bundle, file);
  const type = config.manifest.modules[path]?.type ?? { ".js": "esm", ".mjs": "esm", ".json": "json" }[extname(path)];
  if (!type || type === "sourcemap") continue;
  if (!moduleTypes[type]) throw new Error("未知 Worker 模块类型 " + type);
  form.append(path, new Blob([await readFile(file)], { type: moduleTypes[type] }), path);
}
if (!form.has(config.manifest.mainModule)) throw new Error("缺少 Worker 入口");
const jwt = await uploadAssets();
const source = await version(await latest());
const { bindings, script_runtime: runtime } = source.resources;
const assetConfig = runtime.assets;
const metadata = {
  main_module: config.manifest.mainModule,
  compatibility_date: runtime.compatibility_date,
  compatibility_flags: runtime.compatibility_flags ?? [],
  exports: runtime.exports,
  // Cloudflare 在平台内继承变量、密钥及资源关联。CI 只传绑定名称。
  bindings: bindings.map(({ name, type }) => ({ name, type: type === "assets" ? "assets" : "inherit" })),
  assets: {
    jwt,
    config: {
      html_handling: assetConfig.html_handling,
      not_found_handling: assetConfig.not_found_handling,
      base_path: assetConfig.base_path,
      _headers: assetConfig.raw_headers,
      _redirects: assetConfig.raw_redirects,
      run_worker_first: assetConfig.raw_run_worker_first,
    },
  },
  annotations: { "workers/message": "prod " + process.env.GITHUB_SHA },
};
form.set("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }), "metadata.json");
if ((await latest()) !== source.id) throw new Error("上传期间控制台版本已更新，请重试");
const uploaded = await api(worker + "/versions?bindings_inherit=strict", { body: form });
const candidate = await version(uploaded.id);
if (
  !isDeepStrictEqual(sortBindings(candidate.resources.bindings), sortBindings(bindings)) ||
  !isDeepStrictEqual(candidate.resources.script_runtime, runtime)
) {
  throw new Error("候选版本的运行配置与控制台不一致，流量尚未切换");
}
if ((await latest()) !== candidate.id) throw new Error("已有更新的配置版本，流量尚未切换");
await api(worker + "/deployments", {
  body: { strategy: "percentage", versions: [{ version_id: candidate.id, percentage: 100 }] },
});
console.log("NowX 已发布");
