// Copies the Cajo ABI from the Hardhat build into src/abi. Run after `npx hardhat compile` in the repo root.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const artifact = fileURLToPath(new URL('../../artifacts/contracts/Cajo.sol/Cajo.json', import.meta.url));
const target = fileURLToPath(new URL('../src/abi/Cajo.json', import.meta.url));
const { abi } = JSON.parse(readFileSync(artifact, 'utf8'));
writeFileSync(target, `${JSON.stringify(abi, null, 2)}\n`);
console.log(`Wrote ${abi.length} ABI entries to src/abi/Cajo.json`);
