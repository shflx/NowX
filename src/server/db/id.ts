// 生成与 Prisma @default(cuid()) 相同格式的主键（cuid v1）：
// c + 时间戳 + 计数器 + 指纹 + 随机数，均为 base36，共 25 位。
// 数据库中 id 列没有默认值，插入时必须由应用生成。

const BASE = 36;
const BLOCK = 4;
const MAX = BASE ** BLOCK;

const pad = (value: string, size: number) => value.padStart(size, "0").slice(-size);
const randomInt = () => crypto.getRandomValues(new Uint32Array(1))[0];
const randomBlock = () => pad(randomInt().toString(BASE), BLOCK);

// Workers 不允许在全局作用域生成随机数，计数器与指纹在首次调用时初始化。
// 指纹用于区分不同的运行实例，取随机值即可。
let state: { counter: number; fingerprint: string } | undefined;

export function cuid() {
  state ??= { counter: randomInt() % MAX, fingerprint: randomBlock() };
  state.counter = state.counter < MAX - 1 ? state.counter + 1 : 0;
  return (
    "c" + Date.now().toString(BASE) + pad(state.counter.toString(BASE), BLOCK) + state.fingerprint + randomBlock() + randomBlock()
  );
}
