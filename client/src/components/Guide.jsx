import React, { useState } from 'react';

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold text-white border-b border-gray-800 pb-2">{title}</h2>
      <div className="space-y-2 text-sm text-gray-300 leading-relaxed">{children}</div>
    </div>
  );
}

function Formula({ children }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 font-mono text-xs text-emerald-300 my-2">
      {children}
    </div>
  );
}

function Note({ children }) {
  return (
    <div className="bg-blue-900/20 border border-blue-800/40 rounded-lg px-4 py-3 text-blue-300 text-xs my-2">
      {children}
    </div>
  );
}

function Table({ headers, rows }) {
  return (
    <div className="overflow-x-auto my-2">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-700">
            {headers.map(h => (
              <th key={h} className="text-left py-2 px-3 text-gray-400 font-semibold uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-800/60">
              {row.map((cell, j) => (
                <td key={j} className="py-2 px-3 text-gray-300 font-mono">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Guide() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">

      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Power User Guide</h1>
        <p className="text-gray-500 text-sm">How this tracker thinks about live probabilities and projections.</p>
      </div>

      {/* ── Data Sources ─────────────────────────────────────── */}
      <Section title="Data Sources">
        <p>
          Two APIs power the tracker. Neither requires a paid subscription for basic use.
        </p>
        <Table
          headers={['Source', 'Used for', 'Refresh rate']}
          rows={[
            ['ESPN (unofficial)', 'Live scores, clock, win probability, box scores', '30s (local) / hourly (Vercel)'],
            ['The Odds API (free tier)', 'Pre-game lines, spreads, totals, player props', 'On parlay creation only'],
          ]}
        />
        <Note>
          The Odds API free tier gives 500 requests/month. Odds are fetched once when you open the New Parlay modal — not on a live loop — so you won't burn through them quickly.
        </Note>
      </Section>

      {/* ── Probability Gauge ─────────────────────────────────── */}
      <Section title="The Probability Gauge">
        <p>
          The circular gauge shows the combined estimated probability that your parlay wins. It's the product of all individual leg probabilities.
        </p>
        <Formula>P(parlay) = P(leg₁) × P(leg₂) × … × P(legₙ)</Formula>
        <p>
          Below the gauge, two numbers are compared:
        </p>
        <ul className="list-disc list-inside space-y-1 text-gray-400">
          <li><span className="text-white">Book implies</span> — derived from your stake and payout: <span className="font-mono text-emerald-300">stake / payout</span>. This is the break-even probability the sportsbook priced in (including their vig).</li>
          <li><span className="text-white">Our estimate</span> — live probability computed from ESPN data and odds math. If this is meaningfully higher than "book implies," you have positive expected value on this parlay.</li>
        </ul>
        <Note>
          A positive edge (+X%) means the book underpriced the parlay based on current conditions. A negative edge means the book got the better of you (common — they usually do).
        </Note>
      </Section>

      {/* ── Live Probability Math ─────────────────────────────── */}
      <Section title="How Live Probabilities Are Calculated">

        <p className="font-semibold text-white">Moneyline</p>
        <p>
          Pulled directly from ESPN's win probability model, which updates continuously using their in-house scoring model. When ESPN data isn't available, we fall back to the odds-implied probability.
        </p>

        <p className="font-semibold text-white mt-4">Spread & Total</p>
        <p>
          We use a <span className="text-white">Bayesian blend</span> between the current observed pace and the market prior (the line). Early in the game, the small sample of scoring is noisy, so we weight heavily toward the market. As the game progresses, the observed pace takes over.
        </p>
        <Formula>
          α = elapsed / 3600{'\n'}
          projected = α × pace + (1 - α) × line{'\n'}
          z = (projected - line) / σ{'\n'}
          P(win) = Φ(z)
        </Formula>
        <p>
          Where <span className="font-mono text-emerald-300">σ = √(timeLeft / 60) × 1.4</span> — uncertainty shrinks as time runs out.
        </p>

        <Note>
          Without this blending, 14 points in Q1 would project to 84 total (100% on an over 34.5). With the blend, the same 14 pts at Q1 projects to ~43 and shows ~75% — still bullish but not degenerate.
        </Note>

        <p className="font-semibold text-white mt-4">Player Props</p>
        <p>
          Same Bayesian blend, but the prior uses the <span className="text-white">odds-derived expected value</span> rather than the raw line. See the next section for why this matters.
        </p>
      </Section>

      {/* ── Alt Lines & Odds-Derived Prior ───────────────────── */}
      <Section title="Alt Lines & The Odds-Derived Prior">
        <p>
          When you bet an alternate line (e.g. Nico Collins over 5 rec at +140 instead of the main line at 4.5 rec), using <span className="text-white">5</span> as the expected value is wrong — the market is telling you the true expectation is <em>below</em> 5 (that's why you're getting plus money).
        </p>
        <p>
          We derive the market's true expected stat by inverting the normal CDF:
        </p>
        <Formula>
          μ = line + σ_stat × Φ⁻¹(P(over line)){'\n'}
          {'\n'}
          Example: over 5 rec at +140{'\n'}
          P(over 5) = 100 / (140 + 100) = 41.7%{'\n'}
          Φ⁻¹(0.417) ≈ −0.21{'\n'}
          μ = 5 + 2.5 × (−0.21) ≈ 4.5 catches
        </Formula>
        <p>
          So Nico's true expected catch count is ~4.5, not 5. With 0 catches in Q1 (25% elapsed):
        </p>
        <Formula>
          proj = 0.25 × 0 + 0.75 × 4.5 ≈ 3.4 catches
        </Formula>
        <p>
          The chip shows "proj ~3" in red — he needs 5, we expect ~3.4. This is a much more honest signal than projecting 0 or 4 off a naive line.
        </p>

        <p className="font-semibold text-white mt-4">Stat standard deviations used as priors</p>
        <Table
          headers={['Prop type', 'σ (std dev)', 'Rationale']}
          rows={[
            ['receptions', '2.5', 'Most WRs vary by ±2–3 catches game to game'],
            ['receiving_yards', '28', 'High variance — boom/bust nature of WR yardage'],
            ['rushing_yards', '28', 'RB carries are more consistent but yardage varies'],
            ['passing_yards', '55', 'QB yards have wide range (~150 to ~400+)'],
            ['passing_tds', '1.1', 'Usually 1–4 TDs per game'],
            ['receiving_tds', '0.7', 'Rare enough that σ ≈ line × 0.35 if unknown'],
            ['rushing_tds', '0.6', 'Same — low-frequency event'],
          ]}
        />
        <Note>
          If a prop type isn't in the table, we fall back to σ = max(1, line × 0.35) as a rough estimate.
        </Note>
      </Section>

      {/* ── Score Bubbles ─────────────────────────────────────── */}
      <Section title="Score Bubbles (Per-Leg Chips)">
        <p>
          Each leg shows one or more chips below it when the game is live or final.
        </p>
        <Table
          headers={['Chip', 'Shown for', 'What it means']}
          rows={[
            ['TEN 14 · CLE 7 | Q2 8:23', 'All leg types', 'Live score and game clock'],
            ['proj ~42 pts ↑', 'Totals', 'Bayesian projected final combined score'],
            ['+7 covering', 'Spreads', 'Current actual margin vs. the spread'],
            ['187 yds → proj ~312', 'Player props', 'Current stat + pace-blended projection'],
          ]}
        />
        <p>
          Green chips mean on pace to win the leg. Red chips mean currently off pace. The color does not account for probability — a -3 spread with 4 minutes left on a 7-point lead is still red (not covering) even if the probability is 95%.
        </p>
      </Section>

      {/* ── Leg Status ────────────────────────────────────────── */}
      <Section title="Leg Status Lifecycle">
        <Table
          headers={['Status', 'Meaning']}
          rows={[
            ['Pending', 'Game hasn\'t started or ESPN hasn\'t returned data yet'],
            ['Winning', 'Live game, currently on pace to win this leg'],
            ['Losing', 'Live game, currently off pace'],
            ['Won', 'Game final, leg cashed'],
            ['Lost', 'Game final, leg did not cash'],
            ['Push', 'Landed exactly on the line — stake returned'],
          ]}
        />
        <p>
          A parlay is marked <span className="text-red-400 font-semibold">Lost</span> the moment any leg loses. It's marked <span className="text-emerald-400 font-semibold">Won</span> only when all legs win (pushes are excluded from the parlay calculation per standard book rules — a push leg is treated as if it wasn't in the parlay).
        </p>
      </Section>

      {/* ── Tips ──────────────────────────────────────────────── */}
      <Section title="Tips for Power Users">
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li><span className="text-white">Always enter your actual odds or payout.</span> Without it, the "Book implies" stat is blank and you can't see edge.</li>
          <li><span className="text-white">Enter the leg odds too.</span> Without leg odds, player prop projections fall back to using the raw line as prior — which is wrong for alt lines.</li>
          <li><span className="text-white">Linked game matters.</span> Select a game when adding a leg so ESPN polling can track live scores and box stats.</li>
          <li><span className="text-white">Probability is an estimate, not a guarantee.</span> The model assumes a normal distribution of scores, which breaks down for extreme events (defensive touchdowns, OT, etc.).</li>
          <li><span className="text-white">The poller runs every 30s locally</span>, hourly on Vercel (free tier limit). For games in progress, run the app locally for near-real-time updates.</li>
        </ul>
      </Section>

    </div>
  );
}
