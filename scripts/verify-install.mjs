import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readNonEmptyJson(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing file: ${rel}`);
  }
  const raw = fs.readFileSync(full, "utf8");
  if (!raw.trim()) {
    throw new Error(`Empty or whitespace-only: ${rel}`);
  }
  return JSON.parse(raw);
}

readNonEmptyJson("package.json");
readNonEmptyJson("apps/frontend/package.json");
readNonEmptyJson("apps/backend/package.json");

/** Paths that must exist after `npm ci` / `npm install` at monorepo root (hoisted). */
const mustExist = [
  ["node_modules/next/package.json", "next"],
  ["node_modules/esbuild/install.js", "esbuild (postinstall)"],
  ["node_modules/typescript/package.json", "typescript"],
  ["node_modules/tsx/package.json", "tsx"],
  ["node_modules/@prisma/client/package.json", "@prisma/client"],
  ["node_modules/@swc/helpers/package.json", "@swc/helpers"],
];

for (const [rel, label] of mustExist) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    console.error(`verify-install: missing ${label} → ${rel}`);
    console.error("Run from repo root: npm run reinstall");
    process.exit(1);
  }
}

console.log("verify-install: OK");
