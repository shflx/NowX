import "server-only";

import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";

// 本地磁盘存储。对外只暴露 key（相对路径），以后换成对象存储时只需替换本模块。
// 路径在运行时计算，turbopackIgnore 告诉构建工具不要据此追踪整个项目的文件。

const root = path.resolve(/* turbopackIgnore: true */ process.env.STORAGE_DIR ?? "./storage");

/** 把 key 解析为绝对路径，并防止通过 ../ 越出存储目录 */
function resolveKey(key: string) {
  const full = path.resolve(/* turbopackIgnore: true */ root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("非法的存储路径");
  return full;
}

/** 保存文件，返回存储 key。文件名中只保留扩展名，原始文件名记录在数据库中 */
export async function saveFile(data: Blob, originalName: string) {
  const now = new Date();
  const ext = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 12);
  const key = path.posix.join(
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, "0"),
    `${crypto.randomUUID()}${ext}`,
  );
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, new Uint8Array(await data.arrayBuffer()));
  return key;
}

export async function openFile(key: string) {
  const full = resolveKey(key);
  const info = await stat(full);
  return { size: info.size, stream: Readable.toWeb(createReadStream(full)) as ReadableStream };
}

export async function deleteFile(key: string) {
  await rm(resolveKey(key), { force: true });
}
