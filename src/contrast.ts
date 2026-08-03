import { contrast, type Hex, luminance, ratio } from "./color.ts";
import type { Theme } from "./theme.ts";

const BODY_MIN = 7;
const ACCENT_MIN = 3;
const ANSI0_MAX_LUMINANCE = 0.15;
const ANSI8_MIN = 1.6;

export interface Violation {
  theme: string;
  rule: string;
  detail: string;
}

export const RULES = [
  "foreground",
  "accents",
  "ansi0-dark",
  "light-ansi",
  "ansi8-visible",
];

function at(theme: Theme, index: number): Hex {
  const color = theme.ansi[index];
  if (color === undefined)
    throw new Error(`${theme.name}: missing ANSI ${index}`);
  return color;
}

export function check(theme: Theme): Violation[] {
  const found: Violation[] = [];
  const bg = theme.background;
  const add = (rule: string, detail: string) => {
    if (!theme.waive.includes(rule))
      found.push({ theme: theme.name, rule, detail });
  };

  if (contrast(theme.foreground, bg) < BODY_MIN) {
    add(
      "foreground",
      `foreground ${theme.foreground} on ${bg} is ${ratio(theme.foreground, bg)}:1, needs ${BODY_MIN}:1`,
    );
  }

  for (const i of [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14]) {
    const color = at(theme, i);
    if (contrast(color, bg) < ACCENT_MIN) {
      add(
        "accents",
        `ANSI ${i} ${color} on ${bg} is ${ratio(color, bg)}:1, needs ${ACCENT_MIN}:1`,
      );
    }
  }

  const ansi0 = at(theme, 0);
  if (luminance(ansi0) > ANSI0_MAX_LUMINANCE) {
    add(
      "ansi0-dark",
      `ANSI 0 ${ansi0} has luminance ${luminance(ansi0).toFixed(3)}, needs <= ${ANSI0_MAX_LUMINANCE}`,
    );
  }

  for (const i of [7, 15]) {
    const color = at(theme, i);
    if (contrast(color, bg) < BODY_MIN) {
      add(
        "light-ansi",
        `ANSI ${i} ${color} on ${bg} is ${ratio(color, bg)}:1, needs ${BODY_MIN}:1`,
      );
    }
  }

  const ansi8 = at(theme, 8);
  if (contrast(ansi8, bg) < ANSI8_MIN) {
    add(
      "ansi8-visible",
      `ANSI 8 ${ansi8} on ${bg} is ${ratio(ansi8, bg)}:1, needs ${ANSI8_MIN}:1`,
    );
  }

  return found;
}

export function checkAll(themes: Theme[]): Violation[] {
  return themes.flatMap(check);
}
