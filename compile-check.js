// Standalone compile verification using bundled solc-js (no downloads)
const solc = require("solc");
const fs = require("fs");
const path = require("path");

function findImports(importPath) {
  const p = path.join(__dirname, "node_modules", importPath);
  if (fs.existsSync(p)) return { contents: fs.readFileSync(p, "utf8") };
  return { error: "File not found: " + importPath };
}

const input = {
  language: "Solidity",
  sources: {
    "Cajo.sol": { content: fs.readFileSync("contracts/Cajo.sol", "utf8") },
    "MockUSDT.sol": { content: fs.readFileSync("contracts/MockUSDT.sol", "utf8") },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};

const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errors = (out.errors || []).filter(e => e.severity === "error");
const warnings = (out.errors || []).filter(e => e.severity === "warning");
warnings.forEach(w => console.log("WARN:", w.formattedMessage.split("\n")[0]));
if (errors.length) {
  errors.forEach(e => console.error(e.formattedMessage));
  process.exit(1);
}
const cajo = out.contracts["Cajo.sol"]["Cajo"];
console.log("COMPILED OK");
console.log("Cajo bytecode size:", cajo.evm.bytecode.object.length / 2, "bytes (limit 24576)");
console.log("Functions in ABI:", cajo.abi.filter(x => x.type === "function").map(x => x.name).join(", "));
