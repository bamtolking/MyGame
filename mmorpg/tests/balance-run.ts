// CLI: node tests/balance-run.ts <cls> <seed> <minutes>  → prints one JSON SimResult line
import { simulate } from './sim.ts';
const [cls, seed, min] = process.argv.slice(2);
console.log(JSON.stringify(simulate((cls ?? 'sword') as any, Number(seed ?? 1), Number(min ?? 60))));
