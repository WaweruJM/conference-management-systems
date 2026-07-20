#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Build a comprehensive enterprise Scientific Conference Management System (SCMS) that manages
  the entire conference lifecycle: registration, abstract submission, editorial review, peer review,
  revision cycles, acceptance, programme scheduling, oral/poster management, presentation management,
  proceedings, reporting and long-term archive. Uses PostgreSQL, no external AI, filesystem storage.

backend:
  - task: "PostgreSQL installation and Prisma ORM setup"
    implemented: true
    working: true
    file: "/app/prisma/schema.prisma"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Installed PostgreSQL 15 locally, running via supervisor. Prisma 5.22 with 20+ entity schema pushed."

  - task: "Authentication (register, login, logout, me)"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "JWT auth with bcrypt password hashing, cookie + Bearer token supported. Seed with 8 demo users password123."
      - working: true
        agent: "testing"
        comment: "All authentication tests passed: register new user (200), login all 8 seed accounts with correct roles, GET /auth/me (200), logout (200), invalid credentials return 401. JWT tokens and httpOnly cookies working correctly."

  - task: "Conference CRUD and theme management"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "GET /api/conferences public. Create/update requires SYSTEM_ADMIN or MANAGING_EDITOR."
      - working: true
        agent: "testing"
        comment: "Conference management working: GET /conferences returns CONF2027 with 5 themes (unauthenticated access OK), GET /conferences/{id} returns details (200), POST as author correctly returns 403, POST as admin creates conference (200). Fixed field name from 'location' to 'venue' per Prisma schema."

  - task: "Abstract submission workflow (create, submit, transition, versioning)"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Every abstract has unique submissionCode CONF2027-000001. Draft→Submitted→...→Archived state machine with immutable history. Versions never overwritten."
      - working: true
        agent: "testing"
        comment: "Abstract workflow fully functional: POST /abstracts creates with unique submissionCode (CONF2027-XXXXXX) in DRAFT state (200), POST /abstracts/{id}/submit transitions to SUBMITTED (200), GET /abstracts?scope=mine returns user's abstracts (200). Versioning works: POST /abstracts/{id}/versions creates v2 and auto-transitions to REVISION_SUBMITTED (200). State machine working correctly."

  - task: "Editorial workflow (editor assignment, reviewer assignment, decisions)"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Managing/Section editors can assign editors and reviewers, transition states, record decisions. Auto state transitions on decision (ACCEPT→ACCEPTED etc.)."
      - working: true
        agent: "testing"
        comment: "Editorial workflow complete: Managing editor can see all abstracts (200), POST /abstracts/{id}/assign-editor assigns section editor and transitions to EDITORIAL_ASSIGNMENT (200), POST /abstracts/{id}/assign-reviewer assigns reviewer and transitions to EXTERNAL_PEER_REVIEW (200), POST /abstracts/{id}/decision records decision (MINOR_REVISION, ACCEPT) and auto-transitions state (200). Notifications sent to authors on decisions."

  - task: "Reviewer workspace (invitations, submit review reports)"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Reviewers can list, accept/decline invitations, submit structured review reports (5 scores + comments + recommendation). Double-blind hides author identity."
      - working: true
        agent: "testing"
        comment: "Reviewer workspace working: GET /reviewer/assignments returns pending invitations (200), double-blind correctly hides authors/submittedBy fields, POST /reviewer/assignments/{id}/respond accepts invitation (200), POST /reviewer/assignments/{id}/submit submits review with all required scores and comments (200). All review fields validated."

  - task: "Internal messaging per abstract with notifications"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Messages scoped to abstracts with channels (EDITOR_AUTHOR, EDITOR_REVIEWER etc). Recipients get notifications."
      - working: true
        agent: "testing"
        comment: "Messaging and notifications working: POST /abstracts/{id}/messages sends message with channel and recipients (200), GET /abstracts/{id}/messages lists messages (200), recipients receive MESSAGE type notifications, GET /notifications returns all notifications (200), POST /notifications/{id}/read marks single notification read (200), POST /notifications/read-all marks all read (200)."

  - task: "Document upload/download with categories (filesystem storage)"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Multipart upload to /app/uploads. Categories: ABSTRACT, ETHICS_APPROVAL, PRESENTATION, POSTER etc. Soft delete supported."
      - working: true
        agent: "testing"
        comment: "Document management working: POST /abstracts/{id}/documents uploads file with category (200), GET /abstracts/{id}/documents lists documents (200), GET /documents/{id}/download returns file content (200). FIXED BUG: handleAudit was checking SYSTEM_ADMIN role before route matching, causing 403 for all non-admin users on any unmatched route. Moved role check inside route match condition."

  - task: "Analytics dashboard aggregations"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Aggregates: users by role, abstracts by state/theme, review completion, decisions, registrations."
      - working: true
        agent: "testing"
        comment: "Analytics working: GET /analytics/dashboard returns all required fields (totalUsers, totalAbstracts, usersByRole, abstractsByState, abstractsByTheme, reviews, decisions, totalRegs) with correct aggregations (200). Admin-only access enforced."

  - task: "Audit logging and RBAC"
    implemented: true
    working: true
    file: "/app/lib/auth.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Every action logged. RBAC across 9 roles. Admin-only audit view."
      - working: true
        agent: "testing"
        comment: "Audit and RBAC working: GET /audit returns logs with actions (LOGIN, CREATE_ABSTRACT, etc.) for admin (200), non-admin correctly gets 403. RBAC enforced: author cannot POST decision (403), reviewer cannot GET unassigned abstract (403), author cannot POST /users (403). User management: GET /users lists users (200), POST /users creates user with role (200), both admin-only."

  - task: "Conference Book PDF generation with admin controls"
    implemented: true
    working: true
    file: "/app/lib/pdf.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Sprint D.1 complete. Added ConferenceBook Prisma model. Backend endpoints GET/PUT /api/conferences/:id/book-config (auto-creates with 7 default sections) and GET /api/conferences/:id/book.pdf. PDF has cover page, TOC, chief guest/chair/foreword messages, auto-populated programme, accepted abstracts (with authors/affiliations/keywords), sponsors (from booths), acknowledgements, and page numbers. Admin can toggle & reorder sections. Verified via curl: PDF generated 12KB, %PDF-1.3 header, PUT config persists correctly."

  - task: "Daily feedback surveys with analytics"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Sprint D.2 complete. Added FeedbackSurvey and FeedbackResponse Prisma models. Endpoints: GET/POST /conferences/:id/surveys, PUT/DELETE /surveys/:id, POST /surveys/:id/send (emails all registrants with unique tokens via Resend), GET /surveys/:id/analytics (per-question aggregates, distribution, averages, response rate). Public endpoints: GET/POST /public/survey-response/:token. Supports RATING (1-5, 1-10), MCQ, YESNO, TEXT question types. Max 10 questions enforced. Verified end-to-end: send created 1 token+email, public submit worked, analytics returned 100% response rate with avg 4/5 and correct MCQ distribution."

  - task: "Resend verified domain + reviewer flow fixes"
    implemented: true
    working: true
    file: "/app/.env, /app/app/api/[[...path]]/route.js, /app/app/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          Three fixes: EMAIL_FROM updated to verified medals-scms.com domain. Fixed public /reviewer-invitations/verify/:token 401 error by adding route-prefix guards. Reviewer registration UI overhauled with dedicated invitation card, specialty field, title prefix parsing. ReviewForm enhanced with file attachments and double-blind reminder banner.

  - task: "Conference Programme admin + downloads"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js, /app/lib/pdf.js, /app/app/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          Full Programme admin CRUD + downloads implemented.
          Backend: PUT/DELETE /sessions/:id, POST/PUT/DELETE /programme-items, GET /programme/:id.pdf (branded PDF booklet grouped by day), GET /programme/:id.csv. Fixed regex so .pdf/.csv routes don't shadow the JSON GET /programme/:id. Also fixed abstracts state filter to accept comma-separated list for multi-state queries.
          Frontend: New ProgrammeAdmin component with day-grouped session cards, add/edit/delete session, add abstracts to session (multi-select checkbox picker with search), remove items on hover. Unscheduled-abstracts sidebar. Public Programme page redesigned with day headers, gradient time-badge cards, and PDF/CSV download buttons. Verified: PDF 3.2KB %PDF-1.3, CSV correctly shows all sessions with day/time/room.

  - task: "Feedback survey send UX + test send"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js, /app/app/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          Send button previously appeared unresponsive because there was no loading state and result toast was easy to miss.
          Fixed: Send button now shows 'Sending…' spinner during the (~2-5 second) send call. On completion opens a detailed dispatch dialog showing Delegates / New tokens / Sent / Failed counts. Added new 'Send test' button per-survey which sends only to the admin's own email so they can preview the survey before dispatching to all delegates. Added new backend endpoint POST /surveys/:id/send-test. Empty-delegate case now shown as an amber warning in the dispatch dialog instead of a silent toast.
          Verified: send-test returned admin's email + preview link, send returned created=1, sent=1, failed=0.

  - task: "Sample exhibition booths + premium public layout"
    implemented: true
    working: true
    file: "/app/app/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          Seeded 3 sample sponsor booths with royalty-free banner images. Redesigned ExhibitionBoothsPublic component with premium hero banner, 2-column body, and tab-style sponsor selector.

  - task: "Public pages redesign — guidelines, venue, backgrounds"
    implemented: true
    working: true
    file: "/app/app/page.js, /app/prisma/schema.prisma"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Public redesign for guidelines, venue, backgrounds complete."

  - task: "Editor Workspace"
    implemented: true
    working: true
    file: "/app/app/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          New "My Editor Workspace" sidebar entry (visible to admins + editors) that aggregates ALL abstracts assigned to the current user in one view — eliminating the duplication problem. Uses existing GET /abstracts?scope=assigned endpoint.
          Features:
          - 3 filter tabs (Active / Decided / All) with per-tab counts
          - Cards grouped by workflow state with a Badge header per state
          - Each card shows submission code, title, theme, report type, reviewer count, submission date, and a chevron
          - Click any card opens the existing AbstractDetail per-abstract workspace (which already has editor review, reviewer assignment, correspondence, documents, decision tabs)
          - Common Editorial Office remains untouched and still shows all abstracts to all editors as before

  - task: "Live Conference streaming (LiveKit)"
    implemented: true
    working: true
    file: "/app/components/LiveConference.jsx, /app/app/api/[[...path]]/route.js, /app/prisma/schema.prisma, /app/.env"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          Full LiveKit live conferencing implemented per playbook.
          
          Env: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, NEXT_PUBLIC_LIVEKIT_URL configured on user's cloud project (scms-pa6acvh8.livekit.cloud). Packages installed: livekit-server-sdk, @livekit/components-react, @livekit/components-styles, livekit-client.
          
          Schema: Conference.isLive Boolean field added.
          
          Backend:
          - POST /api/conferences/:id/live — admin/editor toggle broadcast on/off (updates isLive)
          - GET /api/conferences/:id/live-status — public status (used by page to auto-refresh every 15s)
          - POST /api/livekit/token — authenticated token minting. Host role (admin/managing/chief editor) gets canPublish + canSubscribe + canPublishData. Viewer role gets canSubscribe + canPublishData (Q&A only). Viewers blocked with 409 when isLive=false. Room name deterministic: conference-{id}. Token TTL 2h.
          
          Frontend (/app/components/LiveConference.jsx, dynamically imported to avoid SSR issues):
          - "Conference Offline" gradient banner when isLive=false with virtual booth fallback below
          - Admin "Start Live Broadcast" CTA when offline
          - Beautiful centered join card when live
          - Full-screen live view with black stage: LiveKitRoom + VideoConference tracks in GridLayout, ParticipantTile placeholder when host not yet publishing, ControlBar with mic/camera/screenshare (host only)
          - Right-side "Live Q&A" sidebar using useDataChannel('qna') — real-time text chat, host messages badged, timestamps, auto-scroll, Enter-to-send
          - Fullscreen toggle button, End broadcast (admin), Leave button
          - When conference is offline, viewers see the Virtual Exhibition Booth carousel as fallback
          
          Verified: token mint returns valid JWT with correct grants (roomJoin, canPublish, canSubscribe, canPublishData), live-status endpoint public, isLive toggle updates DB and audit-logged.

frontend:
  - task: "SCMS Enterprise UI - all modules"
    implemented: true
    working: false
    file: "/app/app/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Landing page, auth, role-based sidebar, dashboard with charts, submissions list, submit form, abstract detail with timeline/versions/documents/reviews/messages/history tabs, editorial panel, reviewer workspace, programme, analytics, user management, audit log."
      - working: false
        agent: "testing"
        comment: |
          FRONTEND UI TESTING COMPLETE - CRITICAL BUGS FOUND
          
          ✅ WORKING FEATURES:
          1. Landing page: Hero text, 12 module cards, CONF2027 conference card all visible
          2. Authentication: Login form pre-fills managing@scms.io, can change to other accounts, login/logout works
          3. Dashboard: Shows welcome header, recent submissions section, role-based sidebar navigation
          4. Role-based sidebar: Author sees Dashboard/My Abstracts/New Submission/Conferences/Programme. Managing editor sees additional Editorial Office/Analytics. Admin sees User Management/Audit Log
          5. Sidebar active state: Correctly highlights active route with bg-indigo-600
          6. Analytics page: Shows 4 stat cards (Users, Abstracts, Reviews, Registrations) and 4 charts (Abstracts by state, Users by role, Abstracts by theme, Editorial decisions)
          7. User Management (admin): Shows users table with all seed accounts
          8. Audit Log (admin): Shows audit entries with timestamps, actors, actions
          9. Reviewer workspace: Shows completed review assignments with submission codes, status badges
          10. Notifications bell: Opens notification panel, shows notifications list
          11. Abstract detail tabs: All 6 tabs (Overview, Versions, Documents, Reviews, Messages, History) are clickable and render
          12. Timeline: Submission timeline shows stages with correct styling (green for passed, indigo for current)
          
          ❌ CRITICAL BUGS:
          1. **Editorial Office empty**: Managing editor sees "No abstracts match filter" even with "All states" selected. Backend API GET /abstracts returns data (verified in backend tests), but frontend EditorialOffice component is not displaying them. This blocks the entire editorial workflow testing.
          
          2. **Conferences page empty**: The Conferences component shows empty page with just heading. Landing page (unauthenticated) correctly shows CONF2027, but authenticated Conferences page doesn't fetch/display any conferences. Backend GET /conferences returns data (verified in backend tests).
          
          3. **Submission form Select components**: Unable to interact with conference/theme Select dropdowns programmatically. The form loads and shows pre-selected conference, but clicking to change selection causes issues. This may be a Playwright selector issue or a real UI bug with the shadcn Select component.
          
          ⚠️ UNABLE TO TEST (due to bugs above):
          - New submission creation flow (blocked by Select component issue)
          - Editorial actions panel (assign editor, assign reviewer, record decision) - blocked by Editorial Office being empty
          - Complete abstract detail workflow with editorial actions
          - Reviewer accepting invitation and submitting review for new submission
          
          📸 SCREENSHOTS CAPTURED:
          - Landing page, login form, dashboards (author, managing, admin)
          - Analytics with all charts, User Management, Audit Log
          - Reviewer workspace, Notifications panel
          - Editorial Office (empty), Conferences page (empty), Programme page
          - Sidebar active states
          
          🔍 CONSOLE ERRORS:
          - One 401 error from /api/auth/me (likely called before authentication, not critical)
          - No JavaScript errors in console during testing
          
          RECOMMENDATION: Fix EditorialOffice and Conferences components to properly fetch and display data from backend APIs.

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      SCMS enterprise MVP built end-to-end. PostgreSQL + Prisma + Next.js + JWT auth.
      Seed users all password `password123`: admin@scms.io, managing@scms.io, section@scms.io,
      committee@scms.io, reviewer1@scms.io, reviewer2@scms.io, author@scms.io, attendee@scms.io.
      Conference CONF2027 seeded with 5 themes. Please test the full happy path:
      1) login as author@scms.io → create abstract → submit (state DRAFT→SUBMITTED)
      2) login as managing@scms.io → see submission → assign section editor + reviewer
      3) login as reviewer1@scms.io → accept invitation → submit review with scores
      4) back to managing → record ACCEPT decision → check state ACCEPTED, notification to author
      5) as author → check notifications, view timeline, upload revision if needed
      6) verify analytics endpoint returns aggregations
      Also test unauthorized access (403), invalid state transitions, and versioning (multiple revisions per abstract).
  - agent: "testing"
    message: |
      ✅ COMPREHENSIVE BACKEND TEST COMPLETE - ALL 49 TESTS PASSED (100% SUCCESS RATE)
      
      Tested all 15 scenarios end-to-end:
      1. Authentication: register, login (all 8 seed accounts), /auth/me, logout, invalid credentials → 401 ✅
      2. Conferences: GET public list with themes, GET by ID, POST as author → 403, POST as admin → 200 ✅
      3. Abstract lifecycle: create (DRAFT), submit (SUBMITTED), GET scope=mine ✅
      4. Editorial: assign editor (EDITORIAL_ASSIGNMENT), assign reviewer (EXTERNAL_PEER_REVIEW) ✅
      5. Reviewer: list assignments, double-blind (authors hidden), accept invitation, submit review ✅
      6. Decision: POST decision (MINOR_REVISION), verify state transition, author receives notification ✅
      7. Revision: POST new version (v2), auto-transition to REVISION_SUBMITTED ✅
      8. Final acceptance: POST decision (ACCEPT), state becomes ACCEPTED ✅
      9. Documents: upload (multipart), list, download (returns file bytes) ✅
      10. Messages: POST message, GET list, recipients receive notifications ✅
      11. Notifications: GET list, POST read single, POST read-all ✅
      12. Analytics: GET dashboard with all aggregations (users, abstracts, reviews, decisions) ✅
      13. User management: GET users, POST create user (admin-only) ✅
      14. Audit: GET logs (admin-only), non-admin → 403 ✅
      15. RBAC: author POST decision → 403, reviewer GET unassigned abstract → 403, author POST users → 403 ✅
      
      BUGS FIXED:
      1. Conference creation: Changed field 'location' to 'venue' per Prisma schema
      2. Document download 403 error: handleAudit was checking SYSTEM_ADMIN role before route matching, 
         causing 403 for all non-admin users on any unmatched route. Fixed by moving role check inside 
         route match condition.
      3. Test uniqueness: Updated conference code to use timestamp to avoid unique constraint violations
      
      All backend APIs working correctly. State machine transitions validated. RBAC enforced properly.
      Double-blind review working. Notifications sent correctly. File upload/download functional.
  - agent: "testing"
    message: |
      🔍 FRONTEND UI TESTING COMPLETE - 2 CRITICAL BUGS BLOCKING EDITORIAL WORKFLOW
      
      Tested comprehensive UI flows with Playwright automation. Backend APIs confirmed working (49/49 tests passed),
      but frontend has data display issues in 2 key components.
