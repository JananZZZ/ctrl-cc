import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();

const IGNORE_DIRS = new Set([
  ".git", "node_modules", "target", "dist", "build", ".vite", ".next",
  "src-tauri/target", "docs/audit"
]);

const INCLUDE_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".rs", ".toml", ".json", ".css", ".md"
]);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(ROOT, full).replaceAll("\\", "/");
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (!IGNORE_DIRS.has(name) && !IGNORE_DIRS.has(rel)) walk(full, out);
      continue;
    }
    const ext = path.extname(name);
    if (!INCLUDE_EXTS.has(ext)) continue;
    const content = fs.readFileSync(full);
    out.push({
      path: rel,
      ext,
      bytes: content.length,
      lines: content.toString("utf8").split(/\r?\n/).length,
      sha256: crypto.createHash("sha256").update(content).digest("hex"),
    });
  }
  return out;
}

const files = walk(ROOT).sort((a, b) => a.path.localeCompare(b.path));
fs.writeFileSync("docs/audit/repo-inventory.json", JSON.stringify(files, null, 2));
fs.writeFileSync(
  "docs/audit/repo-inventory.md",
  [
    "# Repository Inventory",
    "",
    `Total files: ${files.length}`,
    "",
    "| Path | Lines | Bytes | SHA256 |",
    "|---|---:|---:|---|",
    ...files.map(f => `| ${f.path} | ${f.lines} | ${f.bytes} | \`${f.sha256}\` |`)
  ].join("\n")
);
console.log(`Inventory written: ${files.length} files`);
