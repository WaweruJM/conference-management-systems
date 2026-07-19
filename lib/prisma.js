import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

// Robust env loading: in some production containers .env may not be auto-loaded.
// Try to read /app/.env if DATABASE_URL is missing.
function loadEnvFallback() {
  if (process.env.DATABASE_URL) return
  try {
    const envPath = path.join(process.cwd(), '.env')
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      content.split('\n').forEach(line => {
        const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i)
        if (m && !process.env[m[1]]) {
          let val = m[2].trim()
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1)
          }
          process.env[m[1]] = val
        }
      })
    }
  } catch (e) {
    console.warn('env fallback load failed:', e.message)
  }
}
loadEnvFallback()

// DATABASE_URL must be set via environment or /app/.env — do not hardcode.
const dbUrl = process.env.DATABASE_URL

const globalForPrisma = globalThis

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['error', 'warn'],
  ...(dbUrl ? { datasourceUrl: dbUrl } : {}),
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
