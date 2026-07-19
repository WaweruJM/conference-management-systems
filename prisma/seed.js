const { PrismaClient, Role, ConferenceStatus } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const hash = await bcrypt.hash('password123', 10)

  // Institutions
  const inst1 = await prisma.institution.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000001', name: 'MIT', country: 'USA', city: 'Cambridge' },
  })
  const inst2 = await prisma.institution.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000002', name: 'Oxford University', country: 'UK', city: 'Oxford' },
  })

  const users = [
    { email: 'admin@scms.io', firstName: 'System', lastName: 'Admin', role: Role.SYSTEM_ADMIN, title: 'Dr.', institutionId: inst1.id, country: 'USA' },
    { email: 'managing@scms.io', firstName: 'Margaret', lastName: 'Chen', role: Role.MANAGING_EDITOR, title: 'Prof.', institutionId: inst1.id, country: 'USA' },
    { email: 'section@scms.io', firstName: 'Samuel', lastName: 'Okonkwo', role: Role.SECTION_EDITOR, title: 'Prof.', institutionId: inst2.id, country: 'UK', specialties: ['Machine Learning', 'AI Ethics'] },
    { email: 'committee@scms.io', firstName: 'Carla', lastName: 'Rossi', role: Role.COMMITTEE_MEMBER, title: 'Dr.', institutionId: inst2.id, country: 'Italy', specialties: ['Neural Networks'] },
    { email: 'reviewer1@scms.io', firstName: 'Rajesh', lastName: 'Kumar', role: Role.EXTERNAL_REVIEWER, title: 'Dr.', institutionId: inst1.id, country: 'India', specialties: ['NLP', 'Transformers'] },
    { email: 'reviewer2@scms.io', firstName: 'Yuki', lastName: 'Tanaka', role: Role.EXTERNAL_REVIEWER, title: 'Prof.', institutionId: inst2.id, country: 'Japan', specialties: ['Computer Vision', 'Deep Learning'] },
    { email: 'author@scms.io', firstName: 'Anna', lastName: 'Fischer', role: Role.AUTHOR, title: 'Dr.', institutionId: inst1.id, country: 'Germany', keywords: ['machine learning'] },
    { email: 'attendee@scms.io', firstName: 'Alex', lastName: 'Attendee', role: Role.ATTENDEE, institutionId: inst2.id, country: 'UK' },
  ]

  for (const u of users) {
    const { role, ...userData } = u
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...userData, passwordHash: hash },
    })
    const existing = await prisma.userRole.findFirst({ where: { userId: user.id, role, conferenceId: null } })
    if (!existing) {
      await prisma.userRole.create({ data: { userId: user.id, role } })
    }
  }

  // Note: Conferences are NOT auto-seeded. System admin registers conferences via UI.
  console.log('Seed complete.')
  console.log('Login credentials: password = password123')
  console.log('Emails: admin@scms.io, managing@scms.io, section@scms.io, committee@scms.io, reviewer1@scms.io, reviewer2@scms.io, author@scms.io, attendee@scms.io')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
