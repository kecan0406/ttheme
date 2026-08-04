import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parse } from "smol-toml";
import { type Hex, isHex } from "./color.ts";

export interface CodepointMap {
  range: string;
  family: string;
}

export interface Font {
  family: string;
  size: number;
  codepointMap: CodepointMap[];
}

export interface GhosttyExtras {
  shader?: string;
  iconGhost: Hex;
  iconScreen?: Hex;
}

export interface Theme {
  name: string;
  group: string;
  native?: string;
  order: number;
  role?: "default";
  ansiSource: string;
  background: Hex;
  foreground: Hex;
  cursor: Hex;
  selectionBackground: Hex;
  ansi: Hex[];
  font: Font;
  ghostty: GhosttyExtras;
  waive: string[];
  waiveReason?: string;
}

const DEFAULTS_FILE = "_defaults.toml";

function fail(file: string, message: string): never {
  throw new Error(`${file}: ${message}`);
}

function hex(file: string, field: string, value: unknown): Hex {
  if (typeof value !== "string" || !isHex(value)) {
    fail(
      file,
      `${field} must be "#rrggbb" (lowercase), got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

function str(file: string, field: string, value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    fail(file, `${field} must be a non-empty string`);
  }
  return value;
}

function table(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function readFont(file: string, own: unknown, base: unknown): Font {
  const o = table(own);
  const b = table(base);
  const raw = o.codepoint_map ?? b.codepoint_map ?? [];
  if (!Array.isArray(raw)) fail(file, "font.codepoint_map must be an array");

  return {
    family: str(file, "font.family", o.family ?? b.family),
    size: Number(o.size ?? b.size),
    codepointMap: raw.map((entry) => {
      const e = table(entry);
      return {
        range: str(file, "font.codepoint_map[].range", e.range),
        family: str(file, "font.codepoint_map[].family", e.family),
      };
    }),
  };
}

function readGhostty(
  file: string,
  own: unknown,
  base: unknown,
  cursor: Hex,
): GhosttyExtras {
  const o = table(own);
  const b = table(base);
  const shader = o.shader ?? b.shader;
  const iconGhost = o.icon_ghost ?? b.icon_ghost;
  const iconScreen = o.icon_screen ?? b.icon_screen;

  return {
    shader:
      shader === undefined ? undefined : str(file, "ghostty.shader", shader),
    iconGhost:
      iconGhost === undefined
        ? cursor
        : hex(file, "ghostty.icon_ghost", iconGhost),
    iconScreen:
      iconScreen === undefined
        ? undefined
        : hex(file, "ghostty.icon_screen", iconScreen),
  };
}

function readTheme(
  file: string,
  source: string,
  defaults: Record<string, unknown>,
): Theme {
  const doc = parse(source) as Record<string, unknown>;
  const meta = table(doc.meta);
  const colors = table(doc.colors);
  const contrastRules = table(doc.contrast);

  const ansiRaw = colors.ansi;
  if (!Array.isArray(ansiRaw) || ansiRaw.length !== 16) {
    fail(
      file,
      `colors.ansi must hold exactly 16 colors, got ${
        Array.isArray(ansiRaw) ? ansiRaw.length : typeof ansiRaw
      }`,
    );
  }

  const name = str(file, "meta.name", meta.name);
  if (name !== basename(file, ".toml")) {
    fail(file, `meta.name "${name}" does not match the filename`);
  }

  const role = meta.role;
  if (role !== undefined && role !== "default") {
    fail(file, `meta.role must be "default", got ${JSON.stringify(role)}`);
  }

  const cursor = hex(file, "colors.cursor", colors.cursor);
  const waive = Array.isArray(contrastRules.waive)
    ? contrastRules.waive.map(String)
    : [];
  if (waive.length > 0 && typeof contrastRules.reason !== "string") {
    fail(file, "contrast.waive needs a contrast.reason explaining why");
  }

  return {
    name,
    group: str(file, "meta.group", meta.group),
    native:
      meta.native === undefined
        ? undefined
        : str(file, "meta.native", meta.native),
    order: Number(meta.order),
    role,
    ansiSource: str(file, "meta.ansi_source", meta.ansi_source),
    background: hex(file, "colors.background", colors.background),
    foreground: hex(file, "colors.foreground", colors.foreground),
    cursor,
    selectionBackground: hex(
      file,
      "colors.selection_background",
      colors.selection_background,
    ),
    ansi: ansiRaw.map((c, i) => hex(file, `colors.ansi[${i}]`, c)),
    font: readFont(file, doc.font, defaults.font),
    ghostty: readGhostty(file, doc.ghostty, defaults.ghostty, cursor),
    waive,
    waiveReason:
      typeof contrastRules.reason === "string"
        ? contrastRules.reason
        : undefined,
  };
}

export function loadThemes(dir: string): Theme[] {
  const defaults = parse(
    readFileSync(join(dir, DEFAULTS_FILE), "utf8"),
  ) as Record<string, unknown>;

  const themes = readdirSync(dir)
    .filter((f) => f.endsWith(".toml") && f !== DEFAULTS_FILE)
    .map((f) => readTheme(f, readFileSync(join(dir, f), "utf8"), defaults))
    .sort((a, b) => a.order - b.order);

  const orders = new Set(themes.map((t) => t.order));
  if (orders.size !== themes.length) {
    throw new Error("themes: meta.order must be unique across all themes");
  }
  return themes;
}

export function rotation(themes: Theme[]): Theme[] {
  return themes.filter((t) => t.role === undefined);
}
