const ar = new Intl.NumberFormat("ar-EG");

export const arNum = (n: number) => ar.format(n);

export function plural(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${arNum(n)} ${few}`;
  return `${arNum(n)} ${many}`;
}

export const pages = (n: number) => plural(n, "صفحة واحدة", "صفحتان", "صفحات", "صفحة");
export const passages = (n: number) => plural(n, "مقطع واحد", "مقطعان", "مقاطع", "مقطعاً");

/** Citation numbers in the order they first appear in the answer. */
export function citedNumbers(text: string): number[] {
  const seen: number[] = [];
  for (const m of text.matchAll(/\[(\d+)\]/g)) {
    const n = Number(m[1]);
    if (!seen.includes(n)) seen.push(n);
  }
  return seen;
}
