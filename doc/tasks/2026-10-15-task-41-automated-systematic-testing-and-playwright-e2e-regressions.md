# Task 41: Automated Systematic Regression Testing, Pure Unit Invariants & Playwright E2E Harness

**Date**: 2026-10-15  
**Subsystems**: `tests/`, `package.json`, `playwright.config.ts`, `tests/e2e/`, `tests/unit-domain-invariants.test.mjs`, `.github/workflows/ci.yml`  
**Status**: Completed  
**Type Check**: Verified with `npx tsc --noEmit` (0 errors)

---

## 1. Context & Architectural Challenge

Prior to this task, the repository contained 40 test files and dozens of standalone scripts in `scripts/`, but suffered from critical structural flaws:
1. **Shared Database Concurrency Collisions**: When `npm test` ran, Node.js executed all test files concurrently. Tests modifying academic years or student enrollments clobbered concurrent queries against the shared Supabase PostgreSQL instance, causing false-negative assertion failures.
2. **20 Orphaned Test Suites**: Half of all test files (such as `cad-floor-architect.test.mjs`, `holiday-and-recess-guard.test.mjs`, `terminal-agent-handshake.test.mjs`) were never executed by `npm test`.
3. **Outdated Schema Assertions**: Early test suites still queried `public.workstations` for `Teacher-01`, which had been decoupled into `public.lab_floor_elements` with `element_type = 'teacher_desk'` during Phase 6 CAD Architect refactoring.
4. **Missing Browser E2E Regressions**: While `@playwright/test` was installed, zero configuration or browser specs existed to protect CAD canvas interactions and live cockpit workflows.
5. **Absence of CI/CD Automation**: No GitHub Actions pipeline existed to guard against regressions on commits.

---

## 2. Engineering Solutions Implemented

### A. Test Execution Stabilization & Database Collision Defense
- **Enforced `--test-concurrency=1`**: Configured sequential execution in `package.json` for all database-backed integration test suites to eliminate transient state contamination.
- **Synchronized Schema Invariant in `tests/workstation-floor.test.mjs`**: Updated teacher desk assertion to query `public.lab_floor_elements` for `element_type = 'teacher_desk'`. Verified that all 3 tests pass cleanly.

### B. Tier 1: Pure Domain Invariants Unit Suite (`tests/unit-domain-invariants.test.mjs`)
Created an ultra-fast, zero-database, in-memory unit suite testing core mathematical and cryptographic algorithms:
- **Timetable Conflict Engine (`lib/scheduling/conflict-engine.ts`)**: Validated `getSlotRange`, `slotRangesOverlap`, and `timeRangesOverlap` across edge-touching, multi-slot, and disjoint periods.
- **Calendar Policy Engine (`lib/calendar-policy.ts`)**: Verified Saturday Statutory Weekend recess, Bada Dashain gazetted holiday detection, and standard weekday operational pass-through.
- **Cryptographic Terminal Tokens (`lib/security/terminal-token.ts`)**: Validated stateless HMAC-SHA256 handshake ticket minting, tamper rejection, and session token verification.
- **CAD Floor Math (`lib/workstations/layout-engine.ts`)**: Validated 2% magnetic grid coordinate snapping, clamp bounds (2% to 98%), and natural label sorting (PC-01 ... PC-10).
- **Performance**: 47 unit tests pass in under 15 milliseconds.

### C. Playwright Browser E2E Regression Harness (`playwright.config.ts` & `tests/e2e/`)
- **Configured Playwright**: Created `playwright.config.ts` targeting `baseURL: http://localhost:3000` with 1 worker to ensure database isolation.
- **Implemented E2E Spec (`tests/e2e/cockpit-and-navigation.spec.ts`)**:
  - CAD Floor Plan & Live Cockpit: Verifies viewport mount, living workstation nodes, and zero illegal literal `+` buttons.
  - Institutional Navigation Hub: Verifies `/schedules`, `/maintenance`, `/incidents`, and `/print/records` render with zero 500 crashes.
  - Student Terminal Gateway: Verifies `/terminal/PC-01` renders station identity and pairing interface cleanly.
- **Execution Result**: All 3 Playwright tests passed on Chromium.

### D. Package.json Script Organization & GitHub Actions CI
- **Structured Test Scripts**:
  - `npm run test:unit`: Lightning-fast pure in-memory invariant tests.
  - `npm run test:e2e`: Headless Playwright browser test suite.
  - `npm run test:terminal`: Real-world student terminal test suite.
  - `npm run test:stress`: Extreme high-concurrency system stress benchmark.
  - `npm test`: Canonical sequential regression runner covering all 38 test suites.
- **GitHub Actions Pipeline (`.github/workflows/ci.yml`)**: Automates `npx tsc --noEmit`, `npm run lint`, and `npm run test:unit` on every push and pull request.

---

## 3. Telemetry & Verification Matrix

| Test Suite / Tier | Command | Execution Time | Result |
| :--- | :--- | :--- | :--- |
| **Tier 1: Pure Unit Invariants** | `npm run test:unit` | ~1.1s | **47 / 47 Passed (100%)** |
| **Tier 2: Workstation Floor Regression** | `node ... tests/workstation-floor.test.mjs` | ~1.9s | **3 / 3 Passed (100%)** |
| **Tier 3: Extreme Concurrency Benchmark** | `npm run test:stress` | ~2.5m | **1,000 / 1,000 Requests Passed (0 Errors)** |
| **Tier 4: Playwright Browser E2E** | `npm run test:e2e` | ~2.4m | **3 / 3 E2E Specs Passed (100%)** |
| **Static Type Check** | `npx tsc --noEmit` | ~18s | **0 Errors** |

---

## 4. Artifacts Produced
- `tests/unit-domain-invariants.test.mjs`
- `playwright.config.ts`
- `tests/e2e/cockpit-and-navigation.spec.ts`
- `.github/workflows/ci.yml`
- `package.json` (updated test scripts)
