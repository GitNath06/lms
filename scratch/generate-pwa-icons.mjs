import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const iconsDir = path.resolve(process.cwd(), 'public/icons')
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true })
}

// Brand SVG for LabSync LIMS: Obsidian background (#09090b), Indigo-violet gradient shield (#6366f1 to #8b5cf6), and atom/terminal ring
const svgShield = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="104" fill="#09090B"/>
  <circle cx="256" cy="256" r="220" stroke="#27272A" stroke-width="6"/>
  <defs>
    <linearGradient id="shieldGrad" x1="120" y1="120" x2="392" y2="392" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#6366F1"/>
      <stop offset="50%" stop-color="#4F46E5"/>
      <stop offset="100%" stop-color="#3730A3"/>
    </linearGradient>
    <linearGradient id="ringGrad" x1="160" y1="160" x2="352" y2="352" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#818CF8"/>
    </linearGradient>
  </defs>
  
  <!-- Outer glowing orbital ring -->
  <ellipse cx="256" cy="256" rx="160" ry="64" transform="rotate(-30 256 256)" stroke="url(#ringGrad)" stroke-width="12" stroke-dasharray="8 8" opacity="0.8"/>
  <ellipse cx="256" cy="256" rx="160" ry="64" transform="rotate(30 256 256)" stroke="url(#ringGrad)" stroke-width="12" stroke-dasharray="8 8" opacity="0.8"/>
  
  <!-- Central Institutional Shield -->
  <path d="M256 120 L376 176 V280 C376 348 325 410 256 428 C187 410 136 348 136 280 V176 L256 120 Z" fill="url(#shieldGrad)" stroke="#818CF8" stroke-width="8"/>
  
  <!-- Central Flask & Terminal Atom Core -->
  <circle cx="256" cy="270" r="38" fill="#09090B" stroke="#A5B4FC" stroke-width="6"/>
  <circle cx="256" cy="270" r="16" fill="#38BDF8"/>
  
  <!-- Subtle specular highlight -->
  <path d="M256 136 L360 184 V270 C360 300 345 340 310 375 L256 200 Z" fill="white" opacity="0.12"/>
</svg>
`

const svgMaskable = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#09090B"/>
  <defs>
    <linearGradient id="shieldGrad2" x1="140" y1="140" x2="372" y2="372" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#6366F1"/>
      <stop offset="100%" stop-color="#3730A3"/>
    </linearGradient>
  </defs>
  <path d="M256 140 L360 190 V280 C360 340 315 390 256 406 C197 390 152 340 152 280 V190 L256 140 Z" fill="url(#shieldGrad2)" stroke="#818CF8" stroke-width="8"/>
  <circle cx="256" cy="272" r="32" fill="#09090B" stroke="#A5B4FC" stroke-width="5"/>
  <circle cx="256" cy="272" r="14" fill="#38BDF8"/>
</svg>
`

async function run() {
  const svgBuf = Buffer.from(svgShield)
  const maskableBuf = Buffer.from(svgMaskable)

  await sharp(svgBuf).resize(192, 192).png().toFile(path.join(iconsDir, 'icon-192x192.png'))
  await sharp(svgBuf).resize(512, 512).png().toFile(path.join(iconsDir, 'icon-512x512.png'))
  await sharp(svgBuf).resize(180, 180).png().toFile(path.join(iconsDir, 'apple-touch-icon.png'))
  await sharp(maskableBuf).resize(512, 512).png().toFile(path.join(iconsDir, 'maskable-icon-512x512.png'))

  console.log('Successfully generated all PWA icons in public/icons/')
}

run().catch(console.error)

