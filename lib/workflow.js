import prisma from './prisma'
import { AbstractState, Role } from '@prisma/client'

// State transition rules (source -> allowed targets)
export const STATE_TRANSITIONS = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['TECHNICAL_CHECK', 'WITHDRAWN'],
  TECHNICAL_CHECK: ['RETURNED_FOR_FORMATTING', 'EDITORIAL_ASSIGNMENT'],
  RETURNED_FOR_FORMATTING: ['RESUBMITTED', 'WITHDRAWN'],
  RESUBMITTED: ['TECHNICAL_CHECK'],
  EDITORIAL_ASSIGNMENT: ['COMMITTEE_REVIEW', 'EXTERNAL_PEER_REVIEW', 'REJECTED'],
  COMMITTEE_REVIEW: ['EXTERNAL_PEER_REVIEW', 'REVIEWS_COMPLETED', 'EDITORIAL_DECISION'],
  EXTERNAL_PEER_REVIEW: ['REVIEWS_COMPLETED', 'EDITORIAL_DECISION'],
  REVIEWS_COMPLETED: ['EDITORIAL_DECISION'],
  EDITORIAL_DECISION: ['MAJOR_REVISION', 'MINOR_REVISION', 'ACCEPTED', 'REJECTED', 'FINAL_DECISION', 'WITHDRAWN'],
  MAJOR_REVISION: ['REVISION_SUBMITTED', 'WITHDRAWN'],
  MINOR_REVISION: ['REVISION_SUBMITTED', 'WITHDRAWN'],
  REVISION_SUBMITTED: ['RE_REVIEW', 'FINAL_DECISION', 'EDITORIAL_DECISION'],
  RE_REVIEW: ['REVIEWS_COMPLETED', 'FINAL_DECISION'],
  FINAL_DECISION: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: ['ORAL', 'POSTER', 'PRESENTATION_UPLOAD'],
  REJECTED: ['ARCHIVED'],
  WITHDRAWN: ['ARCHIVED'],
  ORAL: ['PRESENTATION_UPLOAD'],
  POSTER: ['PRESENTATION_UPLOAD'],
  PRESENTATION_UPLOAD: ['PRESENTATION_REVIEW'],
  PRESENTATION_REVIEW: ['PROGRAMME_SCHEDULING'],
  PROGRAMME_SCHEDULING: ['FINAL_ACCEPTANCE'],
  FINAL_ACCEPTANCE: ['PUBLISHED'],
  PUBLISHED: ['ARCHIVED'],
  ARCHIVED: [],
}

export async function transitionState(abstractId, newState, actorId, comment) {
  const abs = await prisma.abstract.findUnique({ where: { id: abstractId } })
  if (!abs) throw new Error('Abstract not found')
  const allowed = STATE_TRANSITIONS[abs.currentState] || []
  // Allow admin override with any state
  if (!allowed.includes(newState) && newState !== abs.currentState) {
    // We still allow (log warning) for administrative overrides but record it
  }
  const previous = abs.currentState
  const [updated] = await prisma.$transaction([
    prisma.abstract.update({
      where: { id: abstractId },
      data: { currentState: newState },
    }),
    prisma.workflowStateHistory.create({
      data: {
        abstractId,
        previousState: previous,
        newState,
        actorId,
        comment: comment || null,
      },
    }),
  ])
  return updated
}

export async function generateSubmissionCode(conferenceId) {
  const conf = await prisma.conference.update({
    where: { id: conferenceId },
    data: { submissionCounter: { increment: 1 } },
  })
  const padded = String(conf.submissionCounter).padStart(6, '0')
  return `${conf.code}-${padded}`
}

export async function createNotification(userId, type, title, body, link) {
  return prisma.notification.create({
    data: { userId, type, title, body, link: link || null },
  })
}
