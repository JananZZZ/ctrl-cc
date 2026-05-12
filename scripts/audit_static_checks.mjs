import fs from "node:fs";

const files = JSON.parse(fs.readFileSync("docs/audit/repo-inventory.json", "utf8"));

const rules = [
  { id: "direct-pty-invoke", re: /invoke(Command)?\(['"`](pty_|pty_v2_|pty_start_|structured_run)/ },
  { id: "direct-interaction-adapter", re: /startPtyV2ClaudeSession|writePtyV2|stopPtyV2|resizePtyV2/ },
  { id: "runtime-write-bypass", re: /pty_v2_write|pty_write/ },
  { id: "react-useeffect", re: /useEffect\s*\(/ },
  { id: "react-setstate", re: /set[A-Z][A-Za-z0-9_]*\s*\(/ },
  { id: "zustand-create", re: /create<.*>\(/ },
  { id: "tauri-listen", re: /listen<|listen\(/ },
  { id: "child-wait", re: /\.wait\(/ },
  { id: "mutex-lock", re: /\.lock\(/ },
  { id: "raw-pty-event", re: /pty:\/\/data|pty:\/\/status|pty:\/\/error|pty:\/\/exit/ },
  { id: "error-swallow", re: /catch\s*\(\s*\)\s*=>|catch\s*\{\s*\}/ },
];

const findings = [];

for (const f of files) {
  const text = fs.readFileSync(f.path, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, idx) => {
    for (const rule of rules) {
      if (rule.re.test(line)) {
        findings.push({
          file: f.path,
          line: idx + 1,
          rule: rule.id,
          text: line.trim().slice(0, 240),
        });
      }
    }
  });
}

fs.writeFileSync("docs/audit/static-findings.json", JSON.stringify(findings, null, 2));
fs.writeFileSync(
  "docs/audit/static-findings.md",
  [
    "# Static Findings",
    "",
    `Total findings: ${findings.length}`,
    "",
    "| File | Line | Rule | Text |",
    "|---|---:|---|---|",
    ...findings.map(x => `| ${x.file} | ${x.line} | ${x.rule} | \`${x.text.replaceAll("|", "\\|")}\` |`)
  ].join("\n")
);
console.log(`Static findings: ${findings.length}`);
