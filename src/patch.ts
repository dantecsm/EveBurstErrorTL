/**
 * Post-inject fix for C01_3.CC
 *
 * Port of the root patch_c01_3.js logic, called by the workflow right
 * after `inject` has generated the uncompressed English CC files, so the
 * fix is baked in before `compress` runs.
 *
 * Rule (as specified by the user):
 *   For every match of the byte pattern
 *     \xFD[^\xFD]+?\x00\x20\xFB\x3C\x00\x38(\xFB[\s\S]{2}){4}
 *     \xFD\x05\x81\x40\x04\x30\x05\x00\x20\xFB\x05\x00
 *     \xFD\x05\x81\xA1\x04\x30\x05\x00\x20\xFB\x05\x00
 *     ... (7 segments, ending with ...\xFD\x05\x81\x40\x04\x30\x05\x00\x20)
 *   take the 2nd byte, add 0x29 => x; locate the first
 *   \x00\x20\xFB\x3C\x00\x38\xFB after the match start, and write x
 *   right after it (1 byte, or 2 bytes little-endian when x > 0xFF).
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

/** The only decompressed EN CC file that contains this pattern. */
export const PATCH_TARGET = "C01_3.CC";

/** Sequence to locate after each match; the write happens right after it. */
const NEEDLE = "\x00\x20\xFB\x3C\x00\x38\xFB";

const PATTERN_PARTS = [
  "\\xFD",
  "[^\\xFD]+?",
  "\\x00\\x20\\xFB\\x3C\\x00\\x38",
  "(\\xFB[\\s\\S]{2}){4}",
  "\\xFD\\x05\\x81\\x40\\x04\\x30\\x05\\x00\\x20\\xFB\\x05\\x00",
  "\\xFD\\x05\\x81\\xA1\\x04\\x30\\x05\\x00\\x20\\xFB\\x05\\x00",
  "\\xFD\\x05\\x81\\x40\\x04\\x30\\x05\\x00\\x20\\xFB\\x05\\x00",
  "\\xFD\\x05\\x81\\xA1\\x04\\x30\\x05\\x00\\x20\\xFB\\x05\\x00",
  "\\xFD\\x05\\x81\\x40\\x04\\x30\\x05\\x00\\x20\\xFB\\x05\\x00",
  "\\xFD\\x05\\x81\\xA1\\x04\\x30\\x05\\x00\\x20\\xFB\\x05\\x00",
  "\\xFD\\x05\\x81\\x40\\x04\\x30\\x05\\x00\\x20",
];

const RE = new RegExp(PATTERN_PARTS.join(""), "g");

export interface PatchDetail {
  /** Match start offset. */
  offset: number;
  /** Second byte of the match (the byte right after the leading 0xFD). */
  secondByte: number;
  /** x = secondByte + 0x29. */
  x: number;
  /** Write position (right after the needle); -1 when skipped. */
  target: number;
  /** Original byte at target before the patch; -1 when skipped. */
  oldByte: number;
  /** True when the needle was not found after the match (no write). */
  skipped: boolean;
}

export interface PatchResult {
  filePath: string;
  exists: boolean;
  /** Pattern matches found. */
  matches: number;
  /** Write operations performed (deduplicated targets). */
  writes: number;
  /** Bytes that actually changed value. */
  changed: number;
  details: PatchDetail[];
}

/**
 * Apply the C01_3.CC length fix to the given file.
 * Idempotent: re-running on an already-fixed file changes nothing.
 * Never throws for missing files or zero matches; returns stats instead.
 */
export function patchC01_3(filePath: string): PatchResult {
  const result: PatchResult = {
    filePath,
    exists: existsSync(filePath),
    matches: 0,
    writes: 0,
    changed: 0,
    details: [],
  };

  if (!result.exists) {
    return result;
  }

  const buf = readFileSync(filePath);
  // latin1: 1 char = 1 byte, string index === byte offset
  const s = buf.toString("latin1");

  // 1. Collect all matches
  const matches: RegExpExecArray[] = [];
  RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(s)) !== null) {
    matches.push(m);
  }
  result.matches = matches.length;

  if (matches.length === 0) {
    return result;
  }

  // 2. Compute x and locate the write point for each match
  const mods = new Map<number, { x: number }>();
  for (const match of matches) {
    const start = match.index;
    const secondByte = s.charCodeAt(start + 1);
    const x = secondByte + 0x29;
    const needleIdx = s.indexOf(NEEDLE, start);
    const target = needleIdx === -1 ? -1 : needleIdx + NEEDLE.length;
    result.details.push({
      offset: start,
      secondByte,
      x,
      target,
      oldByte: target === -1 ? -1 : buf[target],
      skipped: needleIdx === -1,
    });
    if (needleIdx !== -1) {
      mods.set(target, { x });
    }
  }

  if (mods.size === 0) {
    return result;
  }

  // 3. Apply writes (deduplicated targets, last value wins)
  let changed = 0;
  for (const [target, mod] of mods) {
    if (mod.x > 0xFF) {
      const lo = mod.x & 0xff;
      const hi = (mod.x >> 8) & 0xff;
      if (buf[target] !== lo) changed++;
      if (buf[target + 1] !== hi) changed++;
      buf[target] = lo;
      buf[target + 1] = hi;
    } else {
      if (buf[target] !== mod.x) changed++;
      buf[target] = mod.x;
    }
  }
  result.writes = mods.size;
  result.changed = changed;

  writeFileSync(filePath, buf);
  return result;
}
