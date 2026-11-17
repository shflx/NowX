// 生成易读的随机初始密码（前后端共用）：去掉容易混淆的 0/O、1/l/I，并保证同时包含字母和数字
const LETTERS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";

export function generatePassword(length = 10) {
  const alphabet = LETTERS + DIGITS;
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  // 固定一位字母、一位数字，满足密码规则
  chars[0] = LETTERS[bytes[0] % LETTERS.length];
  chars[length - 1] = DIGITS[bytes[length - 1] % DIGITS.length];
  return chars.join("");
}
