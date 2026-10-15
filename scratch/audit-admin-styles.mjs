import fs from 'fs';
import path from 'path';

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function getRelativeLuminance(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function calculateContrastRatio(fgHex, bgHex) {
  const l1 = getRelativeLuminance(fgHex);
  const l2 = getRelativeLuminance(bgHex);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const HEX_MAP = {
  // Surfaces
  'canvas': '#0B0F19',
  'surface-1': '#101726',
  'surface-2': '#151E32',
  'surface-3': '#1A253D',
  'zinc-900': '#18181B',
  'zinc-800': '#27272A',
  'zinc-800/60': '#1D212B',
  'indigo-950/30': '#14172E',
  'emerald-950/30': '#0E221D',
  'amber-950/30': '#251B0E',
  'rose-950/30': '#251216',

  // Foreground text colors
  'white': '#FFFFFF',
  'zinc-50': '#FAFAFA',
  'zinc-100': '#F4F4F5',
  'zinc-200': '#E4E4E7',
  'zinc-300': '#D4D4D8',
  'zinc-400': '#A1A1AA',
  'zinc-500': '#71717A',
  'zinc-600': '#52525B',
  'zinc-700': '#3F3F46',
  'slate-50': '#F8FAFC',
  'slate-100': '#F1F5F9',
  'slate-200': '#E2E8F0',
  'slate-300': '#CBD5E1',
  'slate-400': '#94A3B8',
  'slate-500': '#64748B',
  'emerald-300': '#6EE7B7',
  'emerald-400': '#34D399',
  'emerald-500': '#10B981',
  'amber-300': '#FCD34D',
  'amber-400': '#FBBF24',
  'amber-500': '#F59E0B',
  'rose-300': '#FCA5A5',
  'rose-400': '#F87171',
  'rose-500': '#EF4444',
  'indigo-300': '#A5B4FC',
  'indigo-400': '#818CF8',
  'indigo-500': '#6366F1',
};

// Key elements audited across Admin Panel and Header Bar
const AUDIT_ELEMENTS = [
  {
    role: 'Primary Row Label (Class Name)',
    example: '12 Eng / 11 Sci A',
    file: 'admin/page.tsx:911',
    currentDarkFg: 'white',
    bg: 'surface-1',
    fontSize: '12px (text-xs)',
    weight: 'font-bold (700)',
    lineHeight: '16px',
    isLarge: false
  },
  {
    role: 'Secondary / Subtext (Class Section / Stream)',
    example: 'Computer Engineering',
    file: 'admin/page.tsx:914',
    currentDarkFg: 'zinc-500', // Bug: no dark: variant on text-zinc-500!
    bg: 'surface-1',
    fontSize: '11px (text-[11px])',
    weight: 'font-normal (400)',
    lineHeight: '14px',
    isLarge: false
  },
  {
    role: 'Table Header Label',
    example: 'CLASS & SECTION, SYLLABUS QUOTA',
    file: 'admin/page.tsx:885 / user-access-manager.tsx:288',
    currentDarkFg: 'zinc-400',
    bg: 'surface-2',
    fontSize: '10.5px (text-[10.5px])',
    weight: 'font-bold (700)',
    lineHeight: '14px',
    isLarge: false
  },
  {
    role: 'Primary Row Label (Subject Title)',
    example: 'Web Page Design & Development',
    file: 'admin/page.tsx:983',
    currentDarkFg: 'white',
    bg: 'surface-1',
    fontSize: '12px (text-xs)',
    weight: 'font-bold (700)',
    lineHeight: '16px',
    isLarge: false
  },
  {
    role: 'Secondary Monospace Code (Subject Code)',
    example: 'WPD-9 / SCI-9 / PHY-11',
    file: 'admin/page.tsx:987',
    currentDarkFg: 'zinc-400',
    bg: 'zinc-800/60',
    fontSize: '11px (text-[11px])',
    weight: 'font-bold font-mono (700)',
    lineHeight: '14px',
    isLarge: false
  },
  {
    role: 'Syllabus Quota Text',
    example: '1 Practicals (Plural Bug)',
    file: 'admin/page.tsx:992, 1066',
    currentDarkFg: 'zinc-300',
    bg: 'surface-1',
    fontSize: '12px (text-xs)',
    weight: 'font-bold (700)',
    lineHeight: '16px',
    isLarge: false
  },
  {
    role: 'Card Description / Section Body',
    example: 'Track class strengths, streams, and roll quotas',
    file: 'admin/page.tsx:867',
    currentDarkFg: 'zinc-400',
    bg: 'surface-1',
    fontSize: '12px (text-xs)',
    weight: 'font-normal (400)',
    lineHeight: '16px',
    isLarge: false
  },
  {
    role: 'Admin Primary Page Subtitle',
    example: 'System governance, user authorizations...',
    file: 'admin/page.tsx:609',
    currentDarkFg: 'zinc-400',
    bg: 'canvas',
    fontSize: '12px (text-xs)',
    weight: 'font-normal (400)',
    lineHeight: '16px',
    isLarge: false
  },
  {
    role: 'Safety Switch Label / Precaution Active',
    example: 'Precaution Active',
    file: 'admin/page.tsx:617',
    currentDarkFg: 'zinc-300',
    bg: 'surface-2',
    fontSize: '12px (text-xs)',
    weight: 'font-bold (700)',
    lineHeight: '16px',
    isLarge: false
  },
  {
    role: 'Executive Category Tabs (Inactive)',
    example: 'Academic Curriculum / Facilities & Safety',
    file: 'admin/page.tsx:638',
    currentDarkFg: 'zinc-400',
    bg: 'surface-1',
    fontSize: '13px (text-[13px])',
    weight: 'font-bold (700)',
    lineHeight: '18px',
    isLarge: false
  },
  {
    role: 'Sub-Tab Navigation Pills (Inactive)',
    example: 'Subjects / Periods / Classes / Routine',
    file: 'admin/page.tsx:842',
    currentDarkFg: 'zinc-400',
    bg: 'surface-1',
    fontSize: '12px (text-xs)',
    weight: 'font-bold (700)',
    lineHeight: '16px',
    isLarge: false
  },
  {
    role: 'User Access Table - Staff Email Subtext',
    example: 'saroj.acharya@school.edu.np',
    file: 'user-access-manager.tsx:321',
    currentDarkFg: 'zinc-400',
    bg: 'surface-1',
    fontSize: '11px (text-[11px])',
    weight: 'font-normal (400)',
    lineHeight: '14px',
    isLarge: false
  },
  {
    role: 'User Access Table - Missing Phone Dash',
    example: '—',
    file: 'user-access-manager.tsx:340',
    currentDarkFg: 'zinc-500', // Bug: no dark override
    bg: 'surface-1',
    fontSize: '12px (text-xs)',
    weight: 'font-normal (400)',
    lineHeight: '16px',
    isLarge: false
  },
  {
    role: 'User Role Badge - Super Admin',
    example: 'Super Admin',
    file: 'user-access-manager.tsx:85',
    currentDarkFg: 'indigo-300',
    bg: 'indigo-950/30',
    fontSize: '11px (text-[11px])',
    weight: 'font-bold (700)',
    lineHeight: '14px',
    isLarge: false
  },
  {
    role: 'Lab Status Badge - Operational',
    example: 'Operational',
    file: 'admin/page.tsx:1425',
    currentDarkFg: 'emerald-400',
    bg: 'emerald-950/30',
    fontSize: '11px (text-[11px])',
    weight: 'font-bold (700)',
    lineHeight: '14px',
    isLarge: false
  },
  {
    role: 'Lab Status Badge - Under Maintenance',
    example: 'Under Maintenance',
    file: 'admin/page.tsx:1432',
    currentDarkFg: 'amber-400',
    bg: 'amber-950/30',
    fontSize: '11px (text-[11px])',
    weight: 'font-bold (700)',
    lineHeight: '14px',
    isLarge: false
  },
  {
    role: 'Top Bar - Off-Hours / Inactive Period Badge',
    example: 'OFF-HOURS / RECESS',
    file: 'live-clock-header.tsx:139',
    currentDarkFg: 'zinc-400',
    bg: 'zinc-800/60',
    fontSize: '12px (text-xs)',
    weight: 'font-mono font-medium',
    lineHeight: '16px',
    isLarge: false
  },
  {
    role: 'Top Bar - Active Period Beacon Text',
    example: 'Period 3 (10:45 - 11:30)',
    file: 'live-clock-header.tsx:131',
    currentDarkFg: 'emerald-400',
    bg: 'emerald-950/30',
    fontSize: '12px (text-xs)',
    weight: 'font-bold (700)',
    lineHeight: '16px',
    isLarge: false
  },
  {
    role: 'Top Bar - Gregorian / BS Date Display',
    example: '21 Sep 2026 / 05 Ashwin 2083',
    file: 'live-clock-header.tsx:165',
    currentDarkFg: 'zinc-300',
    bg: 'canvas',
    fontSize: '12px (text-xs)',
    weight: 'font-medium (500)',
    lineHeight: '16px',
    isLarge: false
  },
  {
    role: 'Top Bar - Supabase Cloud Sync Status',
    example: 'Supabase Live',
    file: 'cloud-sync-status.tsx:55',
    currentDarkFg: 'zinc-400',
    bg: 'canvas',
    fontSize: '11px (text-[11px])',
    weight: 'font-mono font-medium',
    lineHeight: '14px',
    isLarge: false
  }
];

console.log('Role | Example | Dark Text Hex | BG Hex | Contrast | Status (4.5:1 / 3:1) | Proposed Fix');
console.log('---|---|---|---|---|---|---');

for (const el of AUDIT_ELEMENTS) {
  const fgHex = HEX_MAP[el.currentDarkFg] || '#FFFFFF';
  const bgHex = HEX_MAP[el.bg] || '#101726';
  const ratio = calculateContrastRatio(fgHex, bgHex);
  const minRequired = el.isLarge ? 3.0 : 4.5;
  const pass = ratio >= minRequired;
  
  // Proposed upgrade
  let proposedFg = el.currentDarkFg;
  if (!pass || el.currentDarkFg.startsWith('zinc-500') || el.currentDarkFg.startsWith('zinc-400')) {
    if (el.role.includes('Secondary') || el.role.includes('Subtext') || el.role.includes('Table Header') || el.role.includes('Code')) {
      proposedFg = 'slate-300';
    } else {
      proposedFg = 'slate-200';
    }
  }
  const proposedHex = HEX_MAP[proposedFg] || '#CBD5E1';
  const newRatio = calculateContrastRatio(proposedHex, bgHex);

  console.log(`**${el.role}** | \`${el.example}\` | ${fgHex} (\`${el.currentDarkFg}\`) | ${bgHex} (\`${el.bg}\`) | **${ratio.toFixed(2)}:1** | ${pass ? 'PASS' : '❌ FAIL'} | Upgrade to \`dark:text-${proposedFg}\` (${proposedHex}) &rarr; **${newRatio.toFixed(2)}:1** (${newRatio >= minRequired ? 'PASS' : 'FAIL'})`);
}
