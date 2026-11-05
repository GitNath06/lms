/**
 * Types and presets for the Terminal & Hardware Telemetry Simulator.
 * Strictly adheres to AGENTS.md rules: no exports of non-functions from 'use server' files.
 */

import type { WorkstationHardwareSpecs } from '@/types/workstations'

export interface SimulatorHardwarePreset {
  key: 'optimal' | 'low_storage' | 'critical_storage' | 'high_end'
  name: string
  subtitle: string
  cpu: string
  ramDisplay: string
  diskDisplay: string
  badge: string
  badgeVariant: 'optimal' | 'warning' | 'danger' | 'studio'
  specs: WorkstationHardwareSpecs
}

export const HARDWARE_PRESETS: Record<string, SimulatorHardwarePreset> = {
  optimal: {
    key: 'optimal',
    name: 'Optimal Station Rig',
    subtitle: 'Healthy nominal lab PC with abundant SSD headroom',
    cpu: 'AMD Ryzen 5 3500U (4C/8T @ 2.10 GHz)',
    ramDisplay: '12 GB RAM (7.4 GB free)',
    diskDisplay: '184.2 GB Free / 238.5 GB SSD (77% Free)',
    badge: 'Nominal Tier',
    badgeVariant: 'optimal',
    specs: {
      cpu: 'AMD Ryzen 5 3500U with Radeon Vega Mobile Gfx',
      cpu_cores: 4,
      ram_gb: 12.0,
      disk_c_total_gb: 238.5,
      disk_c_free_gb: 184.2,
      disk_c_used_pct: 22.8,
      os_caption: 'Windows 11 Pro 64-bit',
      os_build: '22631.3296',
      mac_address: '00:1A:2B:3C:4D:01',
      lan_ip: '192.168.10.101',
      agent_version: '1.2.0-win-x64',
      last_synced_at: new Date().toISOString(),
    },
  },
  low_storage: {
    key: 'low_storage',
    name: 'Low Storage Warning (<15 GB)',
    subtitle: 'Simulates storage warning condition (triggers amber meter)',
    cpu: 'Intel Core i3-10100 (4C/8T @ 3.60 GHz)',
    ramDisplay: '8 GB RAM (3.1 GB free)',
    diskDisplay: '11.8 GB Free / 119.2 GB SSD (9.9% Free)',
    badge: '<15 GB Warning',
    badgeVariant: 'warning',
    specs: {
      cpu: 'Intel(R) Core(TM) i3-10100 CPU @ 3.60GHz',
      cpu_cores: 4,
      ram_gb: 8.0,
      disk_c_total_gb: 119.2,
      disk_c_free_gb: 11.8,
      disk_c_used_pct: 90.1,
      os_caption: 'Windows 10 Pro 64-bit',
      os_build: '19045.3803',
      mac_address: '00:1A:2B:3C:4D:02',
      lan_ip: '192.168.10.102',
      agent_version: '1.2.0-win-x64',
      last_synced_at: new Date().toISOString(),
    },
  },
  critical_storage: {
    key: 'critical_storage',
    name: 'Critical Storage Alert (<5 GB)',
    subtitle: 'Simulates near-exhausted SSD (triggers pulsing red alert)',
    cpu: 'Intel Celeron G5905 (2C/2T @ 3.50 GHz)',
    ramDisplay: '4 GB RAM (1.1 GB free)',
    diskDisplay: '2.3 GB Free / 64.0 GB eMMC (3.6% Free)',
    badge: '<5 GB Critical',
    badgeVariant: 'danger',
    specs: {
      cpu: 'Intel(R) Celeron(R) G5905 CPU @ 3.50GHz',
      cpu_cores: 2,
      ram_gb: 4.0,
      disk_c_total_gb: 64.0,
      disk_c_free_gb: 2.3,
      disk_c_used_pct: 96.4,
      os_caption: 'Windows 10 Home 64-bit',
      os_build: '19045.2965',
      mac_address: '00:1A:2B:3C:4D:03',
      lan_ip: '192.168.10.103',
      agent_version: '1.2.0-win-x64',
      last_synced_at: new Date().toISOString(),
    },
  },
  high_end: {
    key: 'high_end',
    name: 'Studio Workstation Rig',
    subtitle: 'High-performance multimedia & programming node',
    cpu: 'Intel Core i7-12700 (12C/20T @ 2.10 GHz)',
    ramDisplay: '32 GB RAM (24.5 GB free)',
    diskDisplay: '415.8 GB Free / 512.0 GB NVMe (81% Free)',
    badge: 'Studio Flagship',
    badgeVariant: 'studio',
    specs: {
      cpu: '12th Gen Intel(R) Core(TM) i7-12700',
      cpu_cores: 12,
      ram_gb: 32.0,
      disk_c_total_gb: 512.0,
      disk_c_free_gb: 415.8,
      disk_c_used_pct: 18.8,
      os_caption: 'Windows 11 Enterprise',
      os_build: '26100.1742',
      mac_address: '00:1A:2B:3C:4D:04',
      lan_ip: '192.168.10.104',
      agent_version: '1.2.0-win-x64',
      last_synced_at: new Date().toISOString(),
    },
  },
}

export interface DistressBeaconPreset {
  key: string
  title: string
  category: 'peripherals' | 'missing_software' | 'app_freeze' | 'general'
  severity: 'low' | 'medium' | 'high' | 'critical'
  studentName: string
  studentRoll: number
  description: string
  iconName: 'mouse' | 'code' | 'monitor'
}

export const DISTRESS_BEACON_PRESETS: DistressBeaconPreset[] = [
  {
    key: 'mouse_erratic',
    title: 'Mouse Pointer Erratic / Left Click Unresponsive',
    category: 'peripherals',
    severity: 'low',
    studentName: 'Aarav Sharma',
    studentRoll: 14,
    description: 'Optical mouse sensor flickering on desk. Left button does not register clicks.',
    iconName: 'mouse',
  },
  {
    key: 'compiler_crash',
    title: 'Turbo C++ Linker Error L1043: Cannot Open tcconio.lib',
    category: 'missing_software',
    severity: 'high',
    studentName: 'Bipin Adhikari',
    studentRoll: 7,
    description: 'Practical exercise #3 compilation failed. Missing header and library directory configuration.',
    iconName: 'code',
  },
  {
    key: 'monitor_blackout',
    title: 'Monitor Blackout / Video Signal Lost',
    category: 'app_freeze',
    severity: 'critical',
    studentName: 'Sita Poudel',
    studentRoll: 21,
    description: 'Screen went black during practical run. Power LED is flashing amber rapidly.',
    iconName: 'monitor',
  },
]

export interface SimulatorStationState {
  id: string
  label: string
  labId: string
  labName: string
  isBound: boolean
  machineGuid: string | null
  pairingToken: string | null
  hardwareSpecs: WorkstationHardwareSpecs | null
  lastSeenAt: string | null
  openIssuesCount: number
  activeIssues: Array<{
    id: string
    title: string
    severity: string
    source: string
    studentName?: string | null
    studentRoll?: string | null
  }>
}
