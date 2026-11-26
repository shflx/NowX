// 构建时以 WebAssembly.Module 形式导入的 .wasm 文件（argon2id）
declare module "*.wasm" {
  const module: WebAssembly.Module;
  export default module;
}
