/**
 * v2 Production Cleanup Script
 * ------------------------------------------------------------------
 * Prepares the system for v2 production release by:
 *   • Removing all users EXCEPT the system admin (mayshno@gmail.com)
 *   • Clearing all abstracts (and dependent records)
 *   • Resetting the per-conference abstract serial counter to 0
 *   • Purging editor + logistics chat / announcements
 *   • Clearing all message threads
 *   • Clearing audit / user activity logs
 *   • Removing stale registrations, notifications, documents, etc.
 *
 * PRESERVED:
 *   • The admin user (mayshno@gmail.com) + their UserRole rows
 *   • Conferences, themes, sponsorship tiers, system config, templates
 *   • Feedback surveys (structure only — responses cleared)
 *
 * Run:  node prisma/cleanup-v2-production.js
 * ------------------------------------------------------------------
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const ADMIN_EMAIL = 'mayshno@gmail.com'

async function main() {
  const start = Date.now()
  console.log('════════════════════════════════════════════════════════════')
  console.log(' SCMS  v2 PRODUCTION CLEANUP')
  console.log('════════════════════════════════════════════════════════════')

  // 1. Locate the admin (must exist — abort if not)
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })
  if (!admin) {
    console.error(`❌ Admin ${ADMIN_EMAIL} not found. Aborting to prevent data wipe with no admin.`)
    process.exit(1)
  }
  console.log(`✓ Admin preserved: ${admin.email} (id=${admin.id})`)

  // ── 2. Programme (references Abstract via FK — must go first) ─
  console.log('\n[programme] purging …')
  const programmeItems    = await prisma.programmeItem.deleteMany({})
  const programmeSessions = await prisma.programmeSession.deleteMany({})
  console.log(`   programmeItems=${programmeItems.count}  programmeSessions=${programmeSessions.count}`)

  // ── 3. Chat / announcements (Message references Abstract) ────
  console.log('\n[chats] purging …')
  const messages       = await prisma.message.deleteMany({})
  const announcements  = await prisma.editorAnnouncement.deleteMany({})
  console.log(`   messages=${messages.count}  editorAnnouncements=${announcements.count}`)

  // ── 4. Abstract sub-tree (children first for FK safety) ────────
  console.log('\n[abstracts] purging …')
  const reviewReports        = await prisma.reviewReport.deleteMany({})
  const reviewAssignments    = await prisma.reviewAssignment.deleteMany({})
  const reviewerInvitations  = await prisma.reviewerInvitation.deleteMany({})
  const editorialDecisions   = await prisma.editorialDecision.deleteMany({})
  const editorAssignments    = await prisma.editorAssignment.deleteMany({})
  const technicalScores      = await prisma.technicalScore.deleteMany({})
  const workflowHistory      = await prisma.workflowStateHistory.deleteMany({})
  const abstractVersions     = await prisma.abstractVersion.deleteMany({})
  const abstractAuthors      = await prisma.abstractAuthor.deleteMany({})
  const abstracts            = await prisma.abstract.deleteMany({})
  console.log(`   reviewReports=${reviewReports.count}  reviewAssignments=${reviewAssignments.count}  reviewerInvitations=${reviewerInvitations.count}`)
  console.log(`   editorialDecisions=${editorialDecisions.count}  editorAssignments=${editorAssignments.count}  technicalScores=${technicalScores.count}`)
  console.log(`   workflowHistory=${workflowHistory.count}  abstractVersions=${abstractVersions.count}  abstractAuthors=${abstractAuthors.count}`)
  console.log(`   abstracts=${abstracts.count}`)

  // ── 5. Reset the per-conference submission counter ─────────────
  const counterReset = await prisma.conference.updateMany({ data: { submissionCounter: 0 } })
  console.log(`✓ Reset submissionCounter=0 on ${counterReset.count} conference(s)`)

  // ── 6. Registrations, sponsorship, exhibition, feedback ───────
  console.log('\n[registrations & sponsors] purging …')
  const registrations       = await prisma.registration.deleteMany({})
  const sponsorshipRequests = await prisma.sponsorshipRequest.deleteMany({})
  const exhibitionBooths    = await prisma.exhibitionBooth.deleteMany({})
  const feedbackResponses   = await prisma.feedbackResponse.deleteMany({})
  console.log(`   registrations=${registrations.count}  sponsorshipRequests=${sponsorshipRequests.count}`)
  console.log(`   exhibitionBooths=${exhibitionBooths.count}  feedbackResponses=${feedbackResponses.count}`)

  // ── 7. Notifications + password reset tokens ──────────────────
  console.log('\n[user activity] purging …')
  const notifications       = await prisma.notification.deleteMany({})
  const passwordResetTokens = await prisma.passwordResetToken.deleteMany({})
  const auditLogs           = await prisma.auditLog.deleteMany({})
  console.log(`   notifications=${notifications.count}  passwordResetTokens=${passwordResetTokens.count}  auditLogs=${auditLogs.count}`)

  // ── 8. Documents (metadata rows; disk files remain) ───────────
  const documents = await prisma.document.deleteMany({})
  console.log(`   documents=${documents.count}   (uploaded files on disk NOT removed)`)

  // ── 9. Users (keep admin only) ────────────────────────────────
  console.log('\n[users] purging (keeping admin) …')
  const removedUserRoles = await prisma.userRole.deleteMany({
    where: { userId: { not: admin.id } },
  })
  const removedUsers = await prisma.user.deleteMany({
    where: { id: { not: admin.id } },
  })
  console.log(`   userRoles=${removedUserRoles.count}  users=${removedUsers.count}`)

  // ── Summary ────────────────────────────────────────────────────
  const remainingUsers   = await prisma.user.count()
  const remainingAbs     = await prisma.abstract.count()
  const remainingMsgs    = await prisma.message.count()
  const remainingAnnc    = await prisma.editorAnnouncement.count()
  const remainingNotifs  = await prisma.notification.count()

  console.log('\n════════════════════════════════════════════════════════════')
  console.log(' Post-cleanup state:')
  console.log(`   users=${remainingUsers}  abstracts=${remainingAbs}  messages=${remainingMsgs}`)
  console.log(`   announcements=${remainingAnnc}  notifications=${remainingNotifs}`)
  console.log(`   duration: ${((Date.now() - start) / 1000).toFixed(1)}s`)
  console.log('════════════════════════════════════════════════════════════')
  console.log('✅ v2 production cleanup complete.')
}

main()
  .catch((err) => {
    console.error('❌ Cleanup failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
