export type Hex = string;

const HEX = /^#[0-9a-f]{6}$/;

export function isHex(value: string): value is Hex {
  return HEX.test(value);
}

export function rgb(hex: Hex): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

export function unit(channel: number): number {
  return channel / 255;
}

export function luminance(hex: Hex): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: Hex, b: Hex): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

export function ratio(a: Hex, b: Hex): number {
  return Math.round(contrast(a, b) * 100) / 100;
}
