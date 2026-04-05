# Magyar Választási Modellező

## Critical Defaults
- Plan first, code second
- Keep changes small, local, and verifiable
- Preserve existing architecture unless explicitly told otherwise
- Never rewrite large areas of working code without necessity
- Prefer correctness, traceability, and robustness over speed of implementation

## Project Intent
This project is a dashboard for modeling the 2026 Hungarian parliamentary election results, comparing historical election data (2006–2022), and simulating seat allocation scenarios.

Primary goals:
- correctness of election mathematics (D'Hondt, fragment votes, seat allocation)
- reproducible simulation state
- strong auditability of data sources and calculations
- safe data imports and updates
- stable Hungarian-language UI for election analysis

## Domain Rules — Hungarian Electoral System
- Parliament has 199 seats: 106 single-member constituencies (OEVK) + 93 national list seats
- OEVK winners are determined by simple plurality (relative majority, single round)
- List seats are allocated using the D'Hondt method with a 5% threshold (10% for two-party alliances, 15% for three+)
- Fragment votes: losing candidates' votes + winner's surplus (winner votes − runner-up votes − 1) are added to each party's list vote total
- Fragment votes only count for parties that crossed the threshold and fielded a national list
- Independent candidates do not generate fragment votes
- Simple majority: 100 seats; supermajority (two-thirds): 133 seats
- 2026 boundary changes: Budapest 18→16 OEVKs, Pest 12→14, plus Fejér and Csongrád-Csanád redrawn (39 OEVKs affected total)

## Data Source Rules
- Historical election data originates from valasztas.hu (Nemzeti Választási Iroda) — this is the single source of truth for past results
- 2006 and 2010: old electoral system (386 seats, two rounds) — use only national/county-level list results for trend analysis, NOT OEVK-level data
- 2014, 2018, 2022: new system (199 seats) — settlement-level data available, can be reaggregated to 2026 OEVK boundaries
- 2026 OEVK definitions come from vtr.valasztas.hu
- Poll data is user-imported (CSV) and is never treated as source-of-truth for results — always clearly labeled as estimates
- Poll institutes have different methodologies and bases — never mix bases without explicit normalization

## Architecture
- Preserve the architecture already present in the repository
- Do not assume frameworks, modules, routes, or tables exist unless they are present in the codebase
- If the repo uses a frontend/backend split, preserve that split
- If the repo uses a monorepo, preserve package boundaries
- If the repo uses shared types/models, extend them rather than duplicating them
- Prefer existing project conventions over introducing new patterns
- All UI text, labels, buttons, and error messages must be in Hungarian

## Working Mode
- For any non-trivial task, start with a short plan before making code changes
- Break large requests into small, independently testable steps
- Prefer implementing only one approved step at a time
- If a task would require broad edits across many files, stop and propose decomposition first
- Do not jump into implementation if requirements, constraints, or affected modules are unclear
- For simulation-related changes, explicitly identify which data is source-of-truth (historical results) and which values are derived (projections, swings, estimates)

## Scope Control
- Modify only the minimum number of files required for the task
- Do not refactor unrelated code while implementing a feature or bug fix
- Do not rename, move, or reorganize files unless explicitly required
- Do not introduce new libraries, frameworks, or architectural patterns unless explicitly justified
- Reuse existing project patterns before proposing a new abstraction
- Do not change historical result calculation behavior unless explicitly requested and impact is clearly explained

## Grounding Rules
- Do not assume files, routes, DB tables, services, or business rules exist unless they are present in the codebase
- If a required pattern or module cannot be found, say so explicitly before implementing
- Do not invent hidden architecture, undocumented rules, or fake integration points
- Do not invent or fabricate election results, poll numbers, or OEVK data

## Backend Guidance
- Validate request input explicitly before DB writes
- Validate related entity existence (party, OEVK, election year) before creating or linking records
- Prefer predictable, simple queries over overcomplicated abstractions
- The D'Hondt algorithm and fragment vote calculation must be deterministic and testable in isolation

## Database Guidance
- Do not make destructive data changes unless explicitly requested
- Avoid schema changes unless needed for the task
- If schema changes are required:
  - explain why
  - explain migration impact
  - explain any backfill or recalculation needs
- Prefer explicit constraints and indexes for uniqueness where imports rely on deduplication
- Preserve referential integrity between elections, parties, OEVKs, results, polls, and simulations
- Settlement-to-OEVK mappings must track both the original (2014) and new (2026) OEVK assignment

## Frontend Guidance
- Prefer small, focused UI components over large components with mixed responsibilities
- Do not introduce unnecessary global state
- Separate raw numeric values from display-formatted values (e.g., percentage formatting)
- Large tables, charts, and the hemicycle must handle:
  - loading state
  - empty state
  - error state
  - partial data state
- Avoid misleading visualizations when data is incomplete or based on estimates — always indicate data quality/source
- The hemicycle chart, map, and result tables must stay visually consistent with each other
- All labels, tooltips, and messages in Hungarian

## Simulation Integrity
- Simulation inputs (swing values, overrides, list shares) must be clearly separated from historical facts
- Simulation outputs must be labeled as projections, never as actual results
- Uniform swing + OEVK override must compose additively: total_swing = uniform + override
- After applying swings, vote shares must be clamped to [0, 100] and renormalized to sum to 100%
- The simulation must recompute fragment votes from the simulated OEVK results, not use historical fragment data
- Saved simulations must store the complete input state (all parameters) to be fully reproducible

## Performance Guidance
- Prefer correctness first, optimization second
- Avoid premature optimization
- If calculations become expensive (e.g., running 106 OEVK simulations), optimize with measurement and clear boundaries
- Use memoization/caching only where inputs and invalidation rules are clear

## Session Hygiene
- Treat unrelated tasks as separate sessions
- After two failed correction attempts, stop pushing the same approach and restart from a clean plan
- Do not let previous failed attempts drive the final implementation
- Prefer a fresh, focused solution over patching a polluted direction

## Output Expectations
For non-trivial implementation tasks, prefer this structure:
1. Plan
2. Files to change
3. Risks / edge cases
4. Implementation
5. Tests / verification
6. Remaining concerns

## When Unsure
- Ask for clarification only if the ambiguity blocks a safe implementation
- Otherwise, make the safest minimal change that fits existing patterns
- If multiple valid approaches exist, prefer the one with:
  1. lower regression risk
  2. smaller scope
  3. easier verification
  4. better alignment with existing code

## Absolute Don'ts
- Do not silently alter historical election results
- Do not fabricate election data, poll numbers, or OEVK boundaries
- Do not duplicate records on re-import (use upsert or check-before-insert)
- Do not mix simulated/projected values with historical source-of-truth data without clear labeling
- Do not patch over data mismatches without surfacing them
- Do not weaken types or validation to force implementation through
- Do not perform broad refactors while implementing a focused feature
- Do not apply 2006/2010 OEVK-level data as if it were compatible with the post-2014 system
- Do not hardcode party names or colors — these must come from the database/config
