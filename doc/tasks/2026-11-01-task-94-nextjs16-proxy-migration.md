# Task 94: Next.js 16 Proxy Convention Migration

**Date**: 2026-11-01  
**Status**: Completed  
**Subsystems**: `proxy.ts`, `middleware.ts`, Next.js 16+ App Router, RBAC & Route Protection  

---

## 1. Context & Motivation

Next.js 16+ officially deprecated the `middleware.ts` file convention in favor of **`proxy.ts`**:
```text
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
  To migrate automatically, run:
  npx @next/codemod@canary middleware-to-proxy .
  Learn more: https://nextjs.org/docs/messages/middleware-to-proxy
```

In Next.js 16:
- The legacy `middleware.ts` ran exclusively inside the restricted **Edge Runtime** (V8 isolates), which lacked standard Node.js APIs (such as native connection pooling, crypto streaming, and standard Node environment access).
- The new convention `proxy.ts` operates on the full **Node.js runtime** as a first-class network proxy. This eliminates edge runtime compatibility warnings, removes edge packaging overhead, and aligns with standard server-side Node.js behaviors.

---

## 2. Changes Applied

### A. Created `proxy.ts`
- Migrated all route guards, RBAC authorization, and Supabase auth cookie synchronization from `middleware.ts` to `proxy.ts`.
- Exported named `proxy` function and default export `proxy` to satisfy Next.js 16 convention:
  ```typescript
  export async function proxy(request: NextRequest) { ... }
  export default proxy
  export const config = { matcher: [...] }
  ```
- Retained full route protection policies:
  - Account active check (`is_active === false` ➔ `/login?error=account_deactivated`)
  - Registration rejection check (`approval_status === 'rejected'` ➔ `/login?error=account_rejected`)
  - Strict profile lockdown (`approval_status !== 'approved'` ➔ `/profile?notice=pending_verification`)
  - Super admin role check (`pathname.startsWith('/admin')`)
  - Maintenance permissions check (`pathname.startsWith('/maintenance')`)
  - Internal pages protection for unauthenticated sessions
  - Fast-path bypass for Server Action RPC requests (`request.headers.has('next-action')`)

### B. Removed Legacy `middleware.ts`
- Removed `middleware.ts` to eliminate the startup deprecation warning on `next dev` and `next build`.

---

## 3. Verification & Evidence

1. **TypeScript Type Check**:
   - `npx tsc --noEmit` executed across the entire codebase.
   - Result: **0 compilation or type errors**.
2. **Domain Invariants & Collision Test Suite**:
   - Executed: `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/unit-domain-invariants.test.mjs tests/phase6-conflicts-and-audit.test.mjs`
   - Result: **20/20 passed** (0 failures, 0 skipped).

