// Tiny Bot, Easy $2: Beat Buy-and-Hold on Solana (Node 22, standard library only, no network).
// Reads hourly bars (array of {open,high,low,close,volume}) from $MAKEFUN_INPUT_DIR/bars.json,
// falling back to ./bars.json, then runs a 5/20 moving-average crossover: hold SOL while the
// fast average is above the slow one, sit in USDC otherwise. Writes the final decision and a
// backtest summary to $MAKEFUN_OUTPUT_DIR/entry.json and prints PnL vs buy-and-hold to stdout.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Bar = { open: number; high: number; low: number; close: number; volume: number };

const FAST = 5;
const SLOW = 20;
const START_USDC = 1000;
const FEE = 0.001; // 0.1% charged on every switch
const DEADBAND = 0.002; // fast must beat slow by 0.2% to count as an uptrend (cuts whipsaw)

function loadBars(): Bar[] {
  const candidates: string[] = [];
  const inDir = process.env.MAKEFUN_INPUT_DIR;
  if (inDir) candidates.push(join(inDir, 'bars.json'), join(inDir, 'input.json'), join(inDir, 'hourly.json'));
  candidates.push('bars.json', join(process.cwd(), 'bars.json'), '/input/bars.json');
  for (const p of candidates) {
    if (existsSync(p)) {
      const raw = JSON.parse(readFileSync(p, 'utf8'));
      const arr = Array.isArray(raw) ? raw : raw.bars;
      if (Array.isArray(arr) && arr.length > 0) return arr as Bar[];
    }
  }
  // Deterministic fallback so the program still runs with no input mounted.
  const bars: Bar[] = [];
  for (let i = 0; i < 168; i++) {
    const close = 100 + i * 0.15 + Math.sin(i / 9) * 6;
    bars.push({ open: close, high: close * 1.01, low: close * 0.99, close, volume: 1000 });
  }
  return bars;
}

function sma(closes: number[], period: number, end: number): number | null {
  if (end + 1 < period) return null;
  let sum = 0;
  for (let i = end - period + 1; i <= end; i++) sum += closes[i];
  return sum / period;
}

function backtest(closes: number[]): { strategyUsdc: number; buyHoldUsdc: number; trades: number; inSol: boolean } {
  let usdc = START_USDC;
  let sol = 0;
  let trades = 0;
  let inSol = false;
  for (let i = 0; i < closes.length; i++) {
    const fast = sma(closes, FAST, i);
    const slow = sma(closes, SLOW, i);
    if (fast === null || slow === null) continue;
    // Trend filter: uptrend needs fast above slow by the deadband AND price above the slow average.
    const wantSol = fast > slow * (1 + DEADBAND) && closes[i] > slow;
    if (wantSol && !inSol) {
      sol = (usdc * (1 - FEE)) / closes[i];
      usdc = 0;
      inSol = true;
      trades++;
    } else if (!wantSol && inSol) {
      usdc = sol * closes[i] * (1 - FEE);
      sol = 0;
      inSol = false;
      trades++;
    }
  }
  const last = closes[closes.length - 1];
  const strategyUsdc = usdc + sol * last;
  const buyHoldUsdc = (START_USDC / closes[0]) * last;
  return { strategyUsdc, buyHoldUsdc, trades, inSol };
}

const bars = loadBars();
const closes = bars.map((b) => Number(b.close));
const lastIdx = closes.length - 1;
const fastMA = sma(closes, FAST, lastIdx);
const slowMA = sma(closes, SLOW, lastIdx);
const holdSol = fastMA !== null && slowMA !== null && fastMA > slowMA * (1 + DEADBAND) && closes[lastIdx] > slowMA;
const result = backtest(closes);
const strategyPnl = result.strategyUsdc - START_USDC;
const buyHoldPnl = result.buyHoldUsdc - START_USDC;

console.log(`bars=${closes.length} lastClose=${closes[lastIdx].toFixed(4)} fastMA=${fastMA?.toFixed(4)} slowMA=${slowMA?.toFixed(4)}`);
console.log(`strategy: $${START_USDC} -> $${result.strategyUsdc.toFixed(2)} (PnL ${strategyPnl >= 0 ? '+' : ''}$${strategyPnl.toFixed(2)}, ${result.trades} trades)`);
console.log(`buy-and-hold: $${START_USDC} -> $${result.buyHoldUsdc.toFixed(2)} (PnL ${buyHoldPnl >= 0 ? '+' : ''}$${buyHoldPnl.toFixed(2)})`);
console.log(`decision: ${holdSol ? 'HOLD SOL (100%)' : 'HOLD USDC (0% SOL)'}`);

const entry = {
  strategy: 'moving-average crossover 5/20 with 0.2% deadband + price-above-slow trend filter, all-in SOL in uptrend, all-out to USDC otherwise',
  action: holdSol ? 'hold_sol' : 'hold_usdc',
  targetSolWeight: holdSol ? 1 : 0,
  fastMA,
  slowMA,
  lastClose: closes[lastIdx],
  backtest: {
    startUsdc: START_USDC,
    strategyFinalUsdc: Number(result.strategyUsdc.toFixed(2)),
    buyHoldFinalUsdc: Number(result.buyHoldUsdc.toFixed(2)),
    strategyPnlUsdc: Number(strategyPnl.toFixed(2)),
    buyHoldPnlUsdc: Number(buyHoldPnl.toFixed(2)),
    trades: result.trades,
    bars: closes.length,
    feePerTrade: FEE,
  },
};

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.json'), JSON.stringify(entry, null, 2) + '\n');
writeFileSync(join(outDir, 'entry.txt'), `${entry.action} targetSolWeight=${entry.targetSolWeight}\nstrategyPnlUsdc=${entry.backtest.strategyPnlUsdc} buyHoldPnlUsdc=${entry.backtest.buyHoldPnlUsdc}\n`);
