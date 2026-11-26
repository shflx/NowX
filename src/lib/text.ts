// 文本相关的小工具

/**
 * 两段文本是否共享任意一个中文双字词或英文单词。
 * 用于发帖时推荐相似 FAQ：小团队的数据量下，简单的词重叠就足够好用。
 */
export function sharesKeyword(a: string, b: string) {
  const target = b.toLowerCase();
  for (let i = 0; i < a.length - 1; i++) {
    const pair = a.slice(i, i + 2);
    if (/^[一-龥]{2}$/.test(pair) && target.includes(pair)) return true;
  }
  return (a.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).some((word) => target.includes(word));
}

/** 去掉 Markdown 标记，生成列表摘要 */
export function excerpt(markdown: string, length = 80) {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[`*_>#[\]()-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > length ? `${plain.slice(0, length)}…` : plain;
}
