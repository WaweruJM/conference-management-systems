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
    { email: 'chief@scms.io', firstName: 'Helena', lastName: 'Vasquez', role: Role.CHIEF_EDITOR, title: 'Prof.', institutionId: inst1.id, country: 'Spain', specialties: ['Editorial leadership'] },
    { email: 'managing@scms.io', firstName: 'Margaret', lastName: 'Chen', role: Role.MANAGING_EDITOR, title: 'Prof.', institutionId: inst1.id, country: 'USA' },
    { email: 'section@scms.io', firstName: 'Samuel', lastName: 'Okonkwo', role: Role.SECTION_EDITOR, title: 'Prof.', institutionId: inst2.id, country: 'UK', specialties: ['Machine Learning', 'AI Ethics'] },
    { email: 'committee@scms.io', firstName: 'Carla', lastName: 'Rossi', role: Role.COMMITTEE_EDITOR, title: 'Dr.', institutionId: inst2.id, country: 'Italy', specialties: ['Neural Networks'] },
    { email: 'committee2@scms.io', firstName: 'Dmitri', lastName: 'Petrov', role: Role.COMMITTEE_EDITOR, title: 'Dr.', institutionId: inst1.id, country: 'Russia', specialties: ['Data science'] },
    { email: 'reviewer1@scms.io', firstName: 'Rajesh', lastName: 'Kumar', role: Role.EXTERNAL_REVIEWER, title: 'Dr.', institutionId: inst1.id, country: 'India', specialties: ['NLP', 'Transformers'] },
    { email: 'reviewer2@scms.io', firstName: 'Yuki', lastName: 'Tanaka', role: Role.EXTERNAL_REVIEWER, title: 'Prof.', institutionId: inst2.id, country: 'Japan', specialties: ['Computer Vision', 'Deep Learning'] },
    { email: 'chief.logistics@scms.io', firstName: 'Amira', lastName: 'Hassan', role: Role.CHIEF_LOGISTICS, title: 'Dr.', institutionId: inst2.id, country: 'Egypt' },
    { email: 'logistics1@scms.io', firstName: 'Peter', lastName: 'Achieng', role: Role.COMMITTEE_LOGISTICS, title: 'Mr.', institutionId: inst2.id, country: 'Kenya' },
    { email: 'logistics2@scms.io', firstName: 'Sofia', lastName: 'Almeida', role: Role.COMMITTEE_LOGISTICS, title: 'Ms.', institutionId: inst1.id, country: 'Brazil' },
    { email: 'author@scms.io', firstName: 'Anna', lastName: 'Fischer', role: Role.AUTHOR, title: 'Dr.', institutionId: inst1.id, country: 'Germany', keywords: ['machine learning'] },
    { email: 'attendee@scms.io', firstName: 'Alex', lastName: 'Attendee', role: Role.ATTENDEE, institutionId: inst2.id, country: 'UK' },
    { email: 'sponsor@scms.io', firstName: 'Nadia', lastName: 'Karim', role: Role.INDUSTRY_PARTNER, title: 'Ms.', institutionId: inst1.id, country: 'UAE' },
  ]

  for (const u of users) {
    const { role, ...userData } = u
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...userData, passwordHash: hash },
    })
    // Ensure at least the primary role
    const existing = await prisma.userRole.findFirst({ where: { userId: user.id, role, conferenceId: null } })
    if (!existing) {
      await prisma.userRole.create({ data: { userId: user.id, role } })
    }
    // Every editorial / logistics user also carries the AUTHOR role — they can submit abstracts too
    const grantAuthorTo = [
      Role.CHIEF_EDITOR, Role.MANAGING_EDITOR, Role.SECTION_EDITOR, Role.COMMITTEE_EDITOR,
      Role.COMMITTEE_MEMBER, Role.CHIEF_LOGISTICS, Role.COMMITTEE_LOGISTICS,
    ]
    if (grantAuthorTo.includes(role)) {
      const hasAuthor = await prisma.userRole.findFirst({ where: { userId: user.id, role: Role.AUTHOR, conferenceId: null } })
      if (!hasAuthor) await prisma.userRole.create({ data: { userId: user.id, role: Role.AUTHOR } })
    }
  }

  // Note: Conferences are NOT auto-seeded. System admin registers conferences via UI.
  console.log('Seed complete.')
  console.log('Login credentials: password = password123')
  console.log('Emails: admin@scms.io, managing@scms.io, section@scms.io, committee@scms.io, reviewer1@scms.io, reviewer2@scms.io, author@scms.io, attendee@scms.io')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
