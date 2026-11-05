# Task 85: Ultra-Slim Monitor Chin, Realistic Dark Bezel in Light Mode, Smart Split-Color Chin Pill & Edge-to-Edge Projector View

**Date**: 2026-10-27  
**Category**: UI/UX Modernization & Stage Geometry Refinement  
**Target Files**:
- `components/maintenance/workstations/workstation-node.tsx`
- `components/computer-lab/projector-view.tsx`
- `doc/tasks/README.md`

---

## 1. Objectives & Executive Summary

Executed key refinements across the CAD Workstation Node and Wall Seating Projector View:
1. **Soft Greyish Palette Restored & Bezel Reduced**:
   - Replaced harsh bold dark black outer frames in Light Mode with the clean, soft greyish aesthetic of Img1: `border border-zinc-300 dark:border-white/15 bg-white dark:bg-[#111827] shadow-[0_1px_4px_rgba(0,0,0,0.06)]`.
   - Outer bezel padding trimmed to `p-0.5` (only 2px thin rim), eliminating all bulky borders around the inner screen.
   - Screen background is crisp `bg-white dark:bg-[#0A101D]`, and inner extra dark borders have been removed so the screen occupies the full area.

2. **Ultra-Thin Bottom Chin & Micro Bar**:
   - Reduced bottom chin height to `h-[6px]` (`py-0 px-1.5 flex items-center justify-between w-full bg-zinc-100 dark:bg-[#151D2C] border-t border-zinc-200/80 dark:border-white/[0.08] rounded-b-xs shrink-0`).
   - In light theme, the chin uses a delicate soft greyish background (`bg-zinc-100`), completely eliminating bulky black chin blocks.
   - Micro Status Pill: Reduced to `w-4 sm:w-5 h-[2px] rounded-full overflow-hidden flex items-center shrink-0` (encodes vacant, present neon emerald green, absent rose, and temporary relocation angled gradient).
   - Micro Hardware LED: Refined to `h-1 w-1 rounded-full shrink-0`.

3. **Substantial Desk Stand & Pedestal Foot**:
   - Increased the desk/stand part so it looks proportionate to the monitor size:
     - Neck: `w-3.5 sm:w-4 h-1 sm:h-1.5 bg-zinc-300 dark:bg-slate-600 border-x border-zinc-400/60 dark:border-slate-500`
     - Base Pedestal: `w-12 sm:w-14 xl:w-16 h-1 sm:h-1.5 rounded-xs bg-zinc-300 dark:bg-slate-600 border border-zinc-400/70 dark:border-slate-500 shadow-xs`
     - Ground Contact Shadow: `w-14 sm:w-16 xl:w-18 h-0.5 rounded-full bg-zinc-400/30 dark:bg-black/50 blur-[1px]`

4. **Screen Clutter Removal**:
   - Deleted floating top-right `TEMP` badge, inline `ABSENT` badge, and inline attendance green dot.
   - Screen displays strictly: Student Photo (`grayscale opacity-60` if Absent), Student Name, and the full un-truncated `R-XX | PC-XX` line with `whitespace-nowrap`.

5. **Edge-to-Edge Projector View with Vertical & Horizontal Auto-Centering**:
   - Canvas background fills `fixed inset-0 w-screen h-screen rounded-none border-none m-0 p-0 overflow-hidden cad-canvas-grid bg-slate-100 dark:bg-[#0B0F19]`.
   - Computes active workstation bounding box and auto-scales/translates stage dead-center vertically and horizontally (94% width, 92% height).

---

## 2. Verification & Validation Evidence

1. **TypeScript Type Safety**:
   - Ran `npx tsc --noEmit` &rarr; Exited with **Code 0** (0 type or compilation errors across entire Next.js codebase).

2. **Domain Invariant Tests**:
   - Ran `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/unit-domain-invariants.test.mjs` &rarr; **12/12 passing** (100% success).
