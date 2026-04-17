# PRD: Sprint Todo Management

**Author:** Product (parksang1993@gmail.com)
**Date:** 2026-04-16
**Version:** 1.0
**Status:** Approved

---

## 1. Overview

Sprint Todo Management is a web-based, team-oriented todo tracker organized around time-boxed sprints. The single organization can plan a sprint with named goals, assign todos to team members (or leave them in a standing backlog), and watch progress on a shared dashboard. The MVP exists to give a small, co-located team one canonical place to see what they committed to this sprint, who is doing what, and what is falling behind — without the weight of a full PM suite.

## 2. Problem Statement

**User Pain Point:** The team currently coordinates work across ad-hoc chats, personal notes, and whiteboards. Sprint goals get stated at kickoff and forgotten by mid-sprint, assignments drift, and by the end of the sprint no one can tell whether the original goals shipped. Personal todos for each team member are tracked in separate tools, which makes workload visibility impossible.

**Current Workaround:** Shared docs for sprint planning + individual todo apps + Slack pings for status. Information is scattered and stale within 48 hours.

**Business Opportunity:** A single lightweight tool that links *sprint goals* to *concrete todos* to *an owner* gives the team a real commitment model. It should reduce mid-sprint surprises, make goal completion measurable, and become the default place team members check each morning. If adoption holds, it replaces three other tools.

## 3. Goals & Non-Goals

**Goals**
- Let any team member create, edit, and complete todos, optionally attached to a sprint and a sprint goal, within 2 clicks from the dashboard.
- Let a sprint lead plan a sprint with fixed start/end dates and named goals, and see goal-level progress without manual rollup.
- Give every team member a personal dashboard that shows the active sprint, their assigned todos, upcoming deadlines, and recent team activity on one screen.
- Reach **≥ 80% weekly active users out of total team size within 4 weeks of launch** as the primary MVP success signal.

**Non-Goals (v1)**
- Multiple organizations or workspaces — there is exactly one org.
- Native mobile apps (iOS/Android). Responsive web is sufficient.
- Custom sprint schemas beyond fixed-date sprints (no kanban-only mode, no rolling sprints).
- Integrations with external tools (GitHub issues, Jira, Linear, Slack beyond auth).
- Custom workflows per team (the todo status set is fixed: `todo / in-progress / done`).
- Time tracking or effort estimation (story points, hours).
- Reporting/export beyond what the dashboard shows (no CSV export, no burndown charts in v1).

## 4. User Stories

| #  | As a...              | I want to...                                                                 | So that...                                                                              |
|----|----------------------|------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------|
| 1  | Team member          | sign in with my Google or GitHub account                                     | I don't need another password and access is controlled by my existing identity.          |
| 2  | Sprint lead          | create a sprint with a start date, end date, and one or more named goals     | the team has a shared, time-boxed commitment that is visible to everyone.                |
| 3  | Sprint lead          | mark a sprint active, and only one sprint is active at a time                | there is no ambiguity about which sprint the team is currently executing on.             |
| 4  | Team member          | create a todo with title, description, priority, due date, assignee, links, and an optional markdown doc | I can capture everything needed to act on the todo in one place.                        |
| 5  | Team member          | attach a todo to the active sprint and tag it with a specific sprint goal    | progress on each goal is automatically visible without manual reporting.                 |
| 6  | Team member          | create a todo that is not tied to any sprint                                 | I can keep backlog or personal items without forcing them into the current sprint.       |
| 7  | Team member          | see all todos assigned to me across every sprint on a single list            | I always know what is on my plate.                                                       |
| 8  | Team member          | land on a dashboard that shows the active sprint, my todos, upcoming deadlines, and team activity | I get full situational awareness within 5 seconds of opening the app.                   |
| 9  | Team member          | comment on a todo to discuss blockers or clarifications                      | discussion lives next to the work, not in a side chat.                                   |
| 10 | Team member          | receive a notification when a todo is assigned to me or its due date is in < 24h | I don't miss deadlines or surprise assignments.                                         |
| 11 | Sprint lead          | see, for the active sprint, the percentage of todos completed per goal and overall | I know whether the sprint is on track without asking anyone.                            |
| 12 | Sprint lead          | close a sprint at its end date and see which goals and todos finished vs. didn't | the team can reflect on what was committed vs. delivered.                                |

## 5. Functional Requirements

### Authentication & Org Membership
- **FR-01:** Users can sign in using Google OAuth or GitHub OAuth. No email/password flow exists.
- **FR-02:** The first user to sign in becomes the org admin. All subsequent signins from new emails are rejected with a "request access" message unless the admin has added the email to the org allowlist.
- **FR-03:** The org admin can add or remove team members from the org by email from an Admin screen.
- **FR-04:** Users can sign out from a menu accessible on every screen.

### Sprints
- **FR-05:** A user can create a sprint with: name, start date, end date (must be ≥ start date), and zero or more named goals (free-text labels, unique within the sprint).
- **FR-06:** A sprint has one of three statuses: `planned`, `active`, `completed`.
- **FR-07:** At most one sprint can be `active` at a time. Marking a second sprint active requires the currently active sprint to be moved to `completed` first; the system shows a confirmation dialog rather than silently transitioning.
- **FR-08:** A user can edit the name, dates, and goal list of a sprint in any status. Deleting a goal that has todos attached prompts the user to either detach the todos or cancel the delete.
- **FR-09:** A user can delete a sprint only if it is `planned` and has no todos attached. `active` and `completed` sprints cannot be deleted in v1.
- **FR-10:** When a sprint is marked `completed`, its attached todos retain their sprint and goal linkage (read-only association for historical view).

### Todos
- **FR-11:** A todo has: title (required, ≤ 140 chars), description (optional, plain text ≤ 4000 chars), status (`todo` | `in-progress` | `done`, default `todo`), priority (`low` | `medium` | `high`, default `medium`), assignee (optional, a single org member), due date (optional), link list (0+ URLs), one optional attached markdown document (≤ 100KB).
- **FR-12:** A todo can optionally be attached to exactly one sprint. If attached, it can additionally be tagged with exactly one goal from that sprint.
- **FR-13:** A todo not attached to any sprint lives in the backlog and is visible in the Backlog view.
- **FR-14:** Any team member can create, edit, reassign, or delete any todo. There is no per-todo permission model in v1.
- **FR-15:** Marking a todo `done` timestamps its completion time; reopening it clears the timestamp.
- **FR-16:** Detaching a todo from a sprint also clears its goal tag.
- **FR-17:** A todo's markdown document is rendered inline on the todo detail view (GitHub-flavored markdown, images not required in v1).

### Comments
- **FR-18:** Any org member can post a plain-text comment (≤ 2000 chars) on any todo. Comments appear newest-last and display author and timestamp.
- **FR-19:** A user can edit or delete only their own comments; edited comments show an "edited" marker.

### Dashboard
- **FR-20:** The dashboard is the default landing screen after sign-in and has four sections, all visible without scrolling on a 1440x900 viewport:
  - **Active Sprint Overview:** name, date range, per-goal progress (todos done / total), overall sprint progress bar. If no sprint is active, show an empty state with a "Create sprint" CTA.
  - **My Todos:** todos assigned to the current user with status `todo` or `in-progress`, sorted by due date ascending (nulls last). Capped at 10 with a "View all" link.
  - **Upcoming Deadlines:** todos (any assignee) with status ≠ `done` and due date within the next 7 days, sorted ascending.
  - **Team Activity:** last 15 events across the org (todo created, status changed, assigned, completed; comment posted; sprint created/activated/completed), newest first, each with actor, action, target, timestamp.

### Sprint & Backlog Views
- **FR-21:** A Sprints view lists all sprints grouped by status (`active`, `planned`, `completed`), sorted by start date descending within each group.
- **FR-22:** A sprint detail view shows sprint metadata, per-goal sections (todos grouped by goal), and an "Unassigned to goal" section for todos attached to the sprint but not to a goal.
- **FR-23:** A Backlog view lists all todos not attached to any sprint, filterable by assignee, status, and priority.
- **FR-24:** A My Todos view lists all todos assigned to the current user across sprints and backlog, with the same filters.

### Notifications
- **FR-25:** A user receives an in-app notification (shown in a bell menu in the header) when: (a) a todo is assigned to them, (b) a todo assigned to them is due within 24 hours and still not `done`, (c) a comment is posted on a todo they are the assignee of.
- **FR-26:** The bell menu shows unread count and last 20 notifications. Clicking a notification navigates to the target todo and marks it read.
- **FR-27:** Notifications are in-app only in v1 (no email, no push, no Slack).

### Success Measurement
- **FR-28:** The system records a "session" event on every sign-in and a "weekly active" is defined as a user with ≥ 1 session in a rolling 7-day window. An internal admin view displays WAU vs. total org members.

## 6. UX & Design

### User Flow

```
User Flow: Sprint Todo Management

Precondition: User's email is on the org allowlist (or they are the first-ever user).

Happy Path (team member daily use):
1. Sign-in screen -> User clicks "Sign in with Google" or "Sign in with GitHub"
2. OAuth consent -> Returned to app
3. Dashboard -> User sees Active Sprint Overview, My Todos, Upcoming Deadlines, Team Activity
4. User clicks a todo in "My Todos" -> Todo detail panel opens
5. User updates status from `todo` to `in-progress` -> Dashboard reflects change immediately; activity logged
6. User returns to dashboard -> Scans Team Activity for context on teammates

Happy Path (sprint lead, sprint planning):
1. Dashboard -> User clicks "Sprints" in nav
2. Sprints view -> User clicks "New sprint"
3. Sprint form -> User enters name, start date, end date, and adds goals "Ship login V2", "Reduce checkout errors"
4. User saves -> Sprint is created in `planned` status
5. User clicks "Make active" on the planned sprint -> If another sprint is active, system prompts to complete it first
6. Team members then attach todos to the active sprint and goals from the todo form.

Happy Path (sprint close):
1. Sprint lead opens the active sprint's detail view on or after the end date
2. User reviews per-goal progress -> clicks "Complete sprint"
3. Confirmation dialog shows "X of Y todos done, Z goals fully completed" -> User confirms
4. Sprint moves to `completed`; its todos remain linked in read-only view.

Alternate Flows:
- Create a backlog todo: From any screen, click "+ New todo" in header, leave "Sprint" unset -> todo saves to Backlog.
- Reassign a todo: On todo detail, change assignee dropdown -> assignee change logged; old assignee's notification (if any) is not revoked in v1.
- Comment on a todo: On todo detail, type in comment box, submit -> comment appears; assignee is notified (if a different user).

Error States:
- Sign-in rejected (email not on allowlist) -> "Your account is not a member of this workspace. Contact an admin to request access." with admin email mailto.
- Start date after end date on sprint form -> Inline field error, save button disabled.
- Deleting a sprint goal with attached todos -> Modal: "N todos are tagged with this goal. Detach them and delete, or cancel?"
- Two users editing the same todo simultaneously -> Last write wins; a toast "This todo was updated by <user> — reload to see latest" appears to stale viewers within 5s.
- Markdown doc upload > 100KB -> Inline error "File too large (max 100KB)".
- Network failure on save -> Toast "Couldn't save, retry?" with retry button; form state preserved.

Empty States:
- No active sprint -> Dashboard's Active Sprint Overview shows "No active sprint — plan one to start tracking goals" with "Create sprint" CTA.
- My Todos empty -> "Nothing on your plate. Pick up a todo from the sprint board or create one."
- Upcoming Deadlines empty -> "No todos due in the next 7 days."
- Team Activity empty (fresh org) -> "Activity will appear here as your team uses the app."
- Backlog empty -> "No backlog todos. Use Backlog to park work that isn't in a sprint yet."
- No notifications -> "You're all caught up."

Loading States:
- Dashboard first paint -> Each of the four sections shows a skeleton block for up to ~800ms.
- Todo detail opening -> Title shows immediately; description/comments/markdown render as they arrive.
- Any form submission -> Save button shows spinner; form disabled until response.
```

### Wireframes / Mockups

Wireframes to be produced before engineering kickoff. Primary screens to wireframe:
1. Sign-in screen (two OAuth buttons, app name, no other content).
2. Dashboard (four quadrant sections as described in FR-20).
3. Sprints list view.
4. Sprint detail view (goals as sections, todos under each).
5. Todo detail view (panel or full page, including comments and markdown doc).
6. Backlog view.
7. My Todos view.
8. Admin members screen.
9. Notification bell menu (dropdown from header).

### Empty States / Error States / Loading States

Defined inline in the flow above. Every list view must define all three; any screen that goes missing one is considered incomplete.

### Platform-Specific Behavior

| Behavior                     | Desktop web (≥ 1024px)                                       | Mobile web (< 1024px)                                                                 |
|------------------------------|---------------------------------------------------------------|----------------------------------------------------------------------------------------|
| Dashboard layout             | 2x2 grid of the four sections                                 | Single-column stack in this order: Active Sprint, My Todos, Upcoming Deadlines, Team Activity |
| Todo detail                  | Slide-in side panel (~520px) over list                        | Full-page route                                                                        |
| Sprint detail goal sections  | Collapsible, all expanded by default                          | Collapsible, only first goal expanded by default                                       |
| Navigation                   | Persistent left sidebar                                       | Top bar with hamburger menu                                                            |
| "+ New todo" affordance      | Button in header                                              | Floating action button bottom-right                                                    |

No native apps in v1.

## 7. Permissions & Privacy

**Device Permissions:** None. Browser-standard only.

**Data Collected / Stored / Shared:**
- OAuth identity from Google / GitHub: email, display name, avatar URL.
- User-generated content: sprints (name, dates, goals), todos (all fields incl. markdown docs and link URLs), comments, notifications, activity events.
- Product-analytics: sign-in events, feature usage events listed in §8 (tied to user ID).
- Data is not shared with any third party beyond OAuth providers (for auth only). No advertising. No data sold.

**Compliance:**
- Org admin can remove a user, which must also allow deletion of that user's account data on request (account deletion flow for individual users can be out-of-scope for v1 but the data model should not block it).
- The app is internal-team-use only in v1 — no public signup, no external customers — so external regimes (GDPR data subject portal, COPPA, etc.) are not triggered as a product surface. If that changes, this section must be revisited.
- Markdown documents on todos may include arbitrary user-pasted content; they are not scanned.

## 8. Analytics & Instrumentation

**Events to Log:**

| Event Name           | Trigger                                                             | Parameters                                            |
|----------------------|---------------------------------------------------------------------|-------------------------------------------------------|
| `session_started`    | Successful sign-in                                                  | `provider` (google/github), `user_id`                 |
| `sprint_created`     | New sprint saved                                                    | `sprint_id`, `goal_count`, `duration_days`, `user_id` |
| `sprint_activated`   | Sprint status set to `active`                                       | `sprint_id`, `user_id`                                |
| `sprint_completed`   | Sprint status set to `completed`                                    | `sprint_id`, `todo_total`, `todo_done`, `goal_count`, `user_id` |
| `todo_created`       | New todo saved                                                      | `todo_id`, `has_sprint`, `has_goal`, `has_assignee`, `has_due_date`, `priority`, `user_id` |
| `todo_status_changed`| Todo status field updated                                           | `todo_id`, `from`, `to`, `user_id`                    |
| `todo_assigned`      | Assignee set or changed on a todo                                   | `todo_id`, `assignee_user_id`, `user_id`              |
| `comment_posted`     | Comment created on a todo                                           | `todo_id`, `comment_length_bucket`, `user_id`         |
| `notification_opened`| User clicks a notification                                          | `notification_type`, `user_id`                        |
| `dashboard_viewed`   | Dashboard route rendered                                            | `user_id`                                             |

**Success Metrics & Targets:**
- **Primary:** Weekly Active Users / Total Org Members ≥ **80%** by week 4 post-launch.
- **Secondary (descriptive, no hard target in v1):**
  - ≥ 1 sprint created per 2-week period.
  - ≥ 60% of active-sprint todos are tagged to a goal (shows the goal feature is pulling weight; low value would tell us to simplify).
  - Median todos created per WAU per week ≥ 5 (evidence the tool is actually absorbing work).

**A/B Test Design:** None for MVP. Team is too small for statistically meaningful split tests.

## 9. Release Strategy

**Feature Flag / Gradual Rollout:** No public feature flag. The product launches in a single step to the one org.

**Target User Segment:** The full team of the single org. All members are onboarded simultaneously via admin-added allowlist + kickoff meeting.

**Update Requirements:** Web app only — deploys are immediate for all users on next page load. No app store, no force-update.

**Launch plan:**
1. Internal smoke test with 2–3 members for 3 days.
2. Full team onboarding: admin adds all emails; 30-minute kickoff demo; one week of "use it for real" with a back-channel for bug reports.
3. Day-14 retro: check against the WAU target and against the secondary metrics; decide on v1.1 scope.

## 10. Open Questions

| # | Question                                                                                                                                | Owner | Due Date   |
|---|------------------------------------------------------------------------------------------------------------------------------------------|-------|------------|
| 1 | Should a user be able to delete their own account / data independent of admin removal? (Non-blocking for MVP but affects data model.)    | parksang1993 | 2026-04-30 |
| 2 | When a sprint auto-enters its date range, should it auto-activate, or always require manual "Make active"? (v1 draft assumes manual.)   | parksang1993 | 2026-04-23 |
| 3 | Do we need a way to roll unfinished todos from a completed sprint into the next active sprint, or leave them to be manually reattached? | parksang1993 | 2026-04-30 |
| 4 | Is markdown on todos limited to text + links, or should we allow inline images in v1? (Current spec: text + links only.)                | parksang1993 | 2026-04-23 |
| 5 | Do reopened todos (done -> in-progress) fire a new notification to the assignee, or stay silent? (Current spec: silent.)                | parksang1993 | 2026-04-23 |

## 11. Appendix

**Research & context:**
- Target users: the single org's team, primary persona is "engineer/contributor who wants to see both the sprint goal and their own plate on one page."
- Competitive landscape: Linear, Jira, Height, Shortcut, Trello. All are too heavyweight or too generic for a team that wants (sprint → goal → todo) front-and-center with minimal configuration. The MVP deliberately trades breadth for a single clear opinion.
- Assumption: team size is under ~15 members for the foreseeable future; design and performance targets assume that.
- Tech/platform constraints: web-only, responsive, SSO via Google and GitHub. No native apps, no offline mode.

**Glossary:**
- **Sprint:** A time-boxed work period with a start date, end date, and named goals.
- **Goal:** A named objective inside a sprint; todos in that sprint can be tagged to one goal.
- **Todo:** A unit of work. Has status, assignee, priority, due date, links, and optionally one markdown doc. May or may not be attached to a sprint.
- **Backlog:** The set of todos not attached to any sprint.
- **Active sprint:** The at-most-one sprint with status `active`.
