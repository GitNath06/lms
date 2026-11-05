import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LabSync LIMS - Institutional Laboratory ERP',
    short_name: 'LabSync',
    description: 'Institutional Laboratory Operations, Practical Scheduling, Attendance & Maintenance Terminal',
    start_url: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#09090b',
    theme_color: '#09090b',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/maskable-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
    shortcuts: [
      {
        name: 'Live Lab Cockpit',
        short_name: 'Live Lab',
        description: 'Open real-time floor plan and roll-call cockpit',
        url: '/computer-lab',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Weekly Timetable',
        short_name: 'Timetable',
        description: 'View laboratory schedule grid and routines',
        url: '/schedules',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Practical Records',
        short_name: 'Logbook',
        description: 'Review practical session attendance registers',
        url: '/records',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
    ],
  }
}

