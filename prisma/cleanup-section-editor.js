const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
async function main() {
  const rows = await p.userRole.findMany({ where: { role: 'SECTION_EDITOR' } })
  console.log('Found', rows.length, 'SECTION_EDITOR rows')
  for (const r of rows) {
    const has = await p.userRole.findFirst({ where: { userId: r.userId, role: 'COMMITTEE_EDITOR', conferenceId: null } })
    if (!has) await p.userRole.create({ data: { userId: r.userId, role: 'COMMITTEE_EDITOR' } })
    await p.userRole.delete({ where: { id: r.id } })
  }
  console.log('Done.')
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => p.$disconnect())
