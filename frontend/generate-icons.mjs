/**
 * Genera icon-192.png e icon-512.png desde icon.svg
 * usando `sharp` (instalar solo para este script, no es dep de producción).
 *
 * Uso:
 *   npm install --save-dev sharp
 *   node generate-icons.mjs
 *
 * Requiere Node.js >= 18. No es necesario para el deploy en Railway
 * (Railway no ejecuta este script); se corre una vez en local y se
 * sube el resultado a git, O se añade al buildCommand en railway.toml.
 */

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))

async function generateIcons() {
  let sharp
  try {
    sharp = (await import('sharp')).default
  } catch {
    console.error('❌  Instala sharp primero: npm install --save-dev sharp')
    process.exit(1)
  }

  const svgPath = join(__dir, 'public', 'icon.svg')
  const svg     = readFileSync(svgPath)

  const sizes = [192, 512]
  for (const size of sizes) {
    const outPath = join(__dir, 'public', `icon-${size}.png`)
    await sharp(svg)
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(outPath)
    console.log(`✓  icon-${size}.png generado`)
  }

  // favicon.ico (32x32 como PNG renombrado — suficiente para la mayoría de browsers)
  const favicoPath = join(__dir, 'public', 'favicon.ico')
  await sharp(svg)
    .resize(32, 32)
    .png()
    .toFile(favicoPath)
  console.log('✓  favicon.ico generado')

  console.log('\n✅  Íconos PWA listos en /public')
}

generateIcons().catch(console.error)
