// Email templates for common editorial communications
// Each template returns { subject, body } given a context object

export const EMAIL_TEMPLATES = {
  SUBMISSION_RECEIVED: (ctx) => ({
    subject: `[${ctx.submissionCode}] Submission received — ${ctx.conferenceName}`,
    body: `Dear ${ctx.authorTitle || ''} ${ctx.authorName},

Thank you for submitting your abstract to ${ctx.conferenceName}. We are pleased to formally acknowledge receipt of your work.

Submission reference: ${ctx.submissionCode}
Title: ${ctx.title}
Date received: ${new Date().toLocaleString()}

Your abstract will now undergo technical checks and editorial assignment. You will be notified via this platform and email at every stage of the review process. You can track your submission's progress at any time by signing in to the SCMS platform.

We deeply appreciate your interest in ${ctx.conferenceName} and look forward to a fruitful review process.

With warm regards,
${ctx.conferenceName} Editorial Office`,
  }),

  EDITOR_ASSIGNED: (ctx) => ({
    subject: `[${ctx.submissionCode}] You have been assigned as editor`,
    body: `Dear ${ctx.editorName},

You have been assigned as the section editor for the following submission:

Reference: ${ctx.submissionCode}
Title: ${ctx.title}
Conference: ${ctx.conferenceName}

Please sign in to the SCMS platform to review the manuscript, assign reviewers, and coordinate the peer review process.

Thank you for your service to the scientific community.

Regards,
${ctx.conferenceName} Editorial Office`,
  }),

  REVIEW_INVITATION: (ctx) => ({
    subject: `[${ctx.submissionCode}] Invitation to review — ${ctx.conferenceName}`,
    body: `Dear ${ctx.reviewerName},

You are invited to serve as a peer reviewer for the following submission to ${ctx.conferenceName}:

Reference: ${ctx.submissionCode}
Title: ${ctx.title}
Sub-theme: ${ctx.themeName || 'General'}
${ctx.dueDate ? `Please complete your review by: ${new Date(ctx.dueDate).toLocaleDateString()}` : ''}

Please sign in to the SCMS platform to accept or decline this invitation, and to access the anonymised manuscript (double-blind review).

Your scholarly expertise is essential to maintaining the quality of our conference proceedings. We deeply appreciate your consideration.

With sincere thanks,
${ctx.conferenceName} Editorial Office`,
  }),

  DECISION_ACCEPT: (ctx) => ({
    subject: `[${ctx.submissionCode}] Acceptance — ${ctx.conferenceName}`,
    body: `Dear ${ctx.authorTitle || ''} ${ctx.authorName},

Congratulations! We are delighted to inform you that your abstract has been ACCEPTED for presentation at ${ctx.conferenceName}.

Reference: ${ctx.submissionCode}
Title: ${ctx.title}
Presentation type: ${ctx.presentationType || 'To be confirmed'}

${ctx.decisionLetter || ''}

Next steps: Please log in to the SCMS platform to upload your presentation materials (oral slides or poster), biography, and photograph as applicable.

We look forward to welcoming you to ${ctx.conferenceName}.

With warm regards,
${ctx.conferenceName} Editorial Office`,
  }),

  DECISION_REJECT: (ctx) => ({
    subject: `[${ctx.submissionCode}] Decision — ${ctx.conferenceName}`,
    body: `Dear ${ctx.authorTitle || ''} ${ctx.authorName},

Thank you for submitting your work to ${ctx.conferenceName}. After careful editorial and peer review, we regret to inform you that your abstract has not been accepted for this conference.

Reference: ${ctx.submissionCode}
Title: ${ctx.title}

${ctx.decisionLetter || ''}

The reviewers' comments (where provided) are available in the SCMS platform for your reference. We hope that this feedback will be useful for future revisions and submissions.

We sincerely appreciate the time and effort you invested in this work and encourage you to consider us for future submissions.

Yours sincerely,
${ctx.conferenceName} Editorial Office`,
  }),

  DECISION_REVISION: (ctx) => ({
    subject: `[${ctx.submissionCode}] Revision requested — ${ctx.conferenceName}`,
    body: `Dear ${ctx.authorTitle || ''} ${ctx.authorName},

Thank you for your submission to ${ctx.conferenceName}. Following peer review, the editorial committee has decided that your abstract requires ${ctx.revisionType || 'revision'} before a final decision can be made.

Reference: ${ctx.submissionCode}
Title: ${ctx.title}
Decision: ${ctx.decision}

${ctx.decisionLetter || ''}

Please sign in to the SCMS platform to view the reviewer comments in detail and upload a revised version of your abstract along with a point-by-point response to the reviewers' concerns.

We appreciate your prompt attention to these revisions.

With warm regards,
${ctx.conferenceName} Editorial Office`,
  }),

  STATE_CHANGE: (ctx) => ({
    subject: `[${ctx.submissionCode}] Status update: ${ctx.newState}`,
    body: `Dear ${ctx.authorTitle || ''} ${ctx.authorName},

The status of your submission has been updated:

Reference: ${ctx.submissionCode}
Title: ${ctx.title}
New status: ${ctx.newState}
${ctx.comment ? `Editorial note: ${ctx.comment}` : ''}

You can track your submission at any time by signing in to the SCMS platform.

Regards,
${ctx.conferenceName} Editorial Office`,
  }),

  REVISION_RECEIVED: (ctx) => ({
    subject: `[${ctx.submissionCode}] Revision submitted — action required`,
    body: `Dear Editor,

The author has submitted a revised version of the following manuscript:

Reference: ${ctx.submissionCode}
Title: ${ctx.title}
Version: v${ctx.versionNumber}

Please sign in to the SCMS platform to review the revision and determine whether re-review is required.

Regards,
SCMS Editorial Office`,
  }),
}

export function renderEmailHtml({ subject, body, conferenceName, submissionCode }) {
  const safe = (s) => String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1e293b;">
    <div style="background: linear-gradient(135deg, #6366f1, #ec4899); color: white; padding: 18px 22px;">
      <div style="font-size: 12px; opacity: 0.9; letter-spacing: 0.5px;">${safe(conferenceName || 'SCMS Editorial Office')}</div>
      <div style="font-size: 18px; font-weight: bold; margin-top: 2px;">${safe(subject)}</div>
    </div>
    <div style="padding: 22px; background: #ffffff; border: 1px solid #e2e8f0; border-top: 0;">
      <div style="white-space: pre-wrap; line-height: 1.6; font-size: 14px;">${safe(body)}</div>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 22px 0 12px;" />
      <div style="font-size: 11px; color: #64748b;">
        ${submissionCode ? `<b>Reference:</b> ${safe(submissionCode)}<br />` : ''}
        <b>Sent:</b> ${new Date().toLocaleString()}
      </div>
    </div>
    <div style="text-align: center; padding: 10px; font-size: 10px; color: #94a3b8; background: #f8fafc; border: 1px solid #e2e8f0; border-top: 0;">
      Sent via SCMS. To reply, please log in to the platform.
    </div>
  </div>`
}
