import { timingSafeEqual } from "node:crypto";
import { DurableObject } from "cloudflare:workers";
import setupWasm from "argon2id/lib/setup.js";
import simd from "argon2id/dist/simd.wasm";
import scalar from "argon2id/dist/no-simd.wasm";

const format = "$argon2id$v=19$m=19456,t=2,p=1$";
const parameters = { memorySize: 19456, passes: 2, parallelism: 1, tagLength: 32 };
const encode = new TextEncoder();

async function instantiate(module: WebAssembly.Module, imports: WebAssembly.Imports) {
  return { module, instance: await WebAssembly.instantiate(module, imports) };
}

export class PasswordHash extends DurableObject {
  private algorithm?: ReturnType<typeof setupWasm>;

  private async derive(password: Uint8Array, salt: Uint8Array) {
    this.algorithm ??= setupWasm(
      (imports) => instantiate(simd, imports),
      (imports) => instantiate(scalar, imports),
    );
    return (await this.algorithm)({ ...parameters, password, salt });
  }

  async hash(password: string) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const digest = await this.derive(encode.encode(password), salt);
    return (
      format +
      Buffer.from(salt).toString("base64").replace(/=+$/, "") +
      "$" +
      Buffer.from(digest).toString("base64").replace(/=+$/, "")
    );
  }

  async verify(encoded: string, password: string) {
    if (!encoded.startsWith(format)) return false;
    const [saltText, digestText, remainder] = encoded.slice(format.length).split("$");
    if (remainder !== undefined || !saltText || !digestText) return false;
    const salt = Buffer.from(saltText, "base64");
    const expected = Buffer.from(digestText, "base64");
    if (salt.length !== 16 || expected.length !== parameters.tagLength) return false;

    const bytes = encode.encode(password);
    const validLength = bytes.length >= 8;
    const digest = await this.derive(validLength ? bytes : encode.encode("nowx-invalid-password"), salt);
    return timingSafeEqual(digest, expected) && validLength;
  }
}
