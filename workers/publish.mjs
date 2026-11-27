import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
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
  // 构建产物不一定包含 .assetsignore，存在时才按它排除文件
  const ignoreFile = join(assets, ".assetsignore");
  const files = execFileSync(
    "git",
    [
      "ls-files",
      "-z",
      "--others",
      ...(existsSync(ignoreFile) ? ["--exclude-from=" + ignoreFile] : []),
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
// 兼容性标志、静态资源路由（单页应用回退、Worker 优先的路径）与新增的 Durable Object 随代码发布，取自构建产物；
// 其余运行配置、变量、密钥及已有资源关联在控制台管理，由 Cloudflare 在平台内继承。
const compatibilityFlags = config.compatibilityFlags ?? [];
const notFoundHandling = config.assets?.notFoundHandling ?? assetConfig.not_found_handling;
const runWorkerFirst = config.assets?.runWorkerFirst ?? assetConfig.raw_run_worker_first;
// 代码中新增的 Durable Object 类及其绑定随代码发布；控制台已有的绑定仍原样继承。
const exportsConfig = { ...runtime.exports, ...config.exports };
const existing = new Set(bindings.map((binding) => binding.name));
const addedBindings = Object.entries(config.env ?? {})
  .filter(([name, binding]) => binding.type === "durable-object" && !existing.has(name))
  .map(([name, binding]) => ({ name, type: "durable_object_namespace", class_name: binding.exportName }));
const metadata = {
  main_module: config.manifest.mainModule,
  compatibility_date: runtime.compatibility_date,
  compatibility_flags: compatibilityFlags,
  exports: exportsConfig,
  // 已有绑定只传名称，由平台继承；新增的 Durable Object 绑定写明类名。
  bindings: [...bindings.map(({ name, type }) => ({ name, type: type === "assets" ? "assets" : "inherit" })), ...addedBindings],
  assets: {
    jwt,
    config: {
      html_handling: assetConfig.html_handling,
      not_found_handling: notFoundHandling,
      base_path: assetConfig.base_path,
      _headers: assetConfig.raw_headers,
      _redirects: assetConfig.raw_redirects,
      run_worker_first: runWorkerFirst,
    },
  },
  annotations: { "workers/message": "prod " + process.env.GITHUB_SHA },
};
form.set("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }), "metadata.json");
if ((await latest()) !== source.id) throw new Error("上传期间控制台版本已更新，请重试");
const uploaded = await api(worker + "/versions?bindings_inherit=strict", { body: form });
const candidate = await version(uploaded.id);
const {
  assets: candidateAssets,
  compatibility_flags: candidateFlags = [],
  exports: candidateExports,
  ...candidateRuntime
} = candidate.resources.script_runtime;
const { assets: _assets, compatibility_flags: _flags, exports: _exports, ...inheritedRuntime } = runtime;
const added = new Set(addedBindings.map((binding) => binding.name));
const candidateInherited = candidate.resources.bindings.filter((binding) => !added.has(binding.name));
const candidateAdded = candidate.resources.bindings.filter((binding) => added.has(binding.name));
if (
  !isDeepStrictEqual(sortBindings(candidateInherited), sortBindings(bindings)) ||
  !addedBindings.every((expected) =>
    candidateAdded.some(
      (binding) => binding.name === expected.name && binding.type === expected.type && binding.class_name === expected.class_name,
    ),
  ) ||
  !isDeepStrictEqual(candidateExports, exportsConfig) ||
  !isDeepStrictEqual(candidateRuntime, inheritedRuntime) ||
  !isDeepStrictEqual([...candidateFlags].sort(), [...compatibilityFlags].sort()) ||
  candidateAssets?.not_found_handling !== notFoundHandling ||
  !isDeepStrictEqual(candidateAssets?.raw_run_worker_first, runWorkerFirst)
) {
  throw new Error("候选版本的运行配置与预期不一致，流量尚未切换");
}
if ((await latest()) !== candidate.id) throw new Error("已有更新的配置版本，流量尚未切换");
await api(worker + "/deployments", {
  body: { strategy: "percentage", versions: [{ version_id: candidate.id, percentage: 100 }] },
});
console.log("NowX 已发布");
