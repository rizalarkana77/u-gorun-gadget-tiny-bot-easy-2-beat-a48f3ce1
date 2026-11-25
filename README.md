# Tiny Bot, Easy $2: Beat Buy-and-Hold on Solana

[![make.fun](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1?ref=9f4fsyjb)
[![Rank](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/rizalarkana77/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/rank.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1?ref=9f4fsyjb)
[![Reward](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/rizalarkana77/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/reward.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1?ref=9f4fsyjb)

A make.fun entry for the "Tiny Bot, Easy $2: Beat Buy-and-Hold on Solana" bounty: one small Node 22 program (standard library only, no network) that reads hourly SOL bars and decides when to hold SOL and when to sit in USDC, scored on net PnL in USDC against buy-and-hold.

## The strategy

A 5/20 moving-average crossover on hourly closes. While the 5-hour average sits above the 20-hour average the bot holds 100% SOL; the moment it crosses below, the bot sells everything into USDC and waits. No leverage, no partial sizing — one binary switch, charged a 0.1% fee per trade in the internal backtest.

Why it can beat buy-and-hold: buy-and-hold rides every drawdown to the bottom. The crossover keeps the upside of sustained uptrends (the fast average stays above the slow one for the whole move) and steps aside during downtrends, so the portfolio avoids the deepest part of each drop and re-enters only once the trend has actually turned. On hourly bars SOL trends in multi-hour waves, which is exactly the timescale a 5/20 pair reacts to — fast enough to exit early in a slide, slow enough to ignore single-bar noise. In a flat, choppy market the strategy can whipsaw and underperform; the fee in the backtest makes that cost visible instead of hiding it.

## How it works

Input: hourly bars as a JSON array of `{open, high, low, close, volume}` objects, read from `$MAKEFUN_INPUT_DIR/bars.json` (falling back to `./bars.json`). With no input mounted the program generates a deterministic synthetic series so it still runs end to end.

Run it:

```
mkdir -p out && MAKEFUN_INPUT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
```

Expected output: a short backtest summary on stdout (bars seen, last close, fast/slow averages, strategy PnL vs buy-and-hold PnL from a $1,000 start, trade count, and the final decision), plus `out/entry.json` holding the decision (`hold_sol` / `hold_usdc`, target SOL weight, averages, and the backtest numbers) and a one-line `out/entry.txt` summary. The program is deterministic: the same bars always produce the same bytes.
