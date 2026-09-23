# Demo accounts

Created by `npm run db:reset` (profile `minimal`; the `demo` profile adds the Ridgeline school data on top).
All passwords: **`KoryoDemo!2026`**. Fictional people and schools.

## Ridgeline Taekwondo (`ridgeline`, full Academy AI plan, America/New_York)

| Role | Email | Name | Lands on |
|---|---|---|---|
| Owner | owner@ridgelinetkd.demo | Master Alex Kim (demo persona) | /desk |
| Admin | admin@ridgelinetkd.demo | Jordan Lee | /desk |
| Front desk | frontdesk@ridgelinetkd.demo | Priya Shah | /desk |
| Instructor | instructor@ridgelinetkd.demo | Sabumnim Grace Park | /mat |
| Assistant instructor | assistant@ridgelinetkd.demo | Evan Brooks | /mat |
| Parent | parent@ridgelinetkd.demo | Morgan Cooper | /home |
| Student | student@ridgelinetkd.demo | Riley Adams | /home |

### Demo profile extras (`npm run db:reset -- --profile demo`)

| Role | Email | Name |
|---|---|---|
| Front desk | frontdesk2@ridgelinetkd.demo | Nia Robinson |
| Instructor | instructor2@ridgelinetkd.demo | Kyoshi Daniel Cho (CPR expires in 20 days) |
| Instructor | instructor3@ridgelinetkd.demo | Ms. Hannah Brooks (Little Tigers, Demo Team) |
| Instructor | instructor4@ridgelinetkd.demo | Master Omar Haddad (Adult program) |

- Cooper family (Morgan + Maya 8 + Leo 11) kiosk PIN: **4321**. Other families have random PINs (set new ones on the household page).
- Staff time clock (kiosk → **Staff clock**): every Ridgeline staff member's PIN is **2468** (demo profile). Change it on Desk → Staff → the person.
- M3 demo data: 9 pipeline leads (2 with trials booked this week), **Saturday Belt Test** next Saturday (Youth Taekwondo; 3 registered and paid, the rest of the eligible roster ready to invite), Fall Break Camp (5 days, 22 registered), Parents' Night Out, Belt Ceremony, one birthday party (deposit paid, 3 guest waivers), After-School Club (18 kids, 3 schools, 2 routes, ~60 days of attendance, weekly billing), 8 automations on with run history, 2 broadcasts sent (Outbox), staff pay rates, time entries and shifts; one staff certification expiring within 30 days.
- ~220 students in ~130 households, 5 programs, 28 weekly classes, 24 months of attendance with steady / improving /
  decaying / sporadic / new patterns, promotions, stripes and sign-offs derived from attendance, waiver v1 (18 months
  old) and v2 (published last week, so families are prompted to re-sign), 15 conversations and Outbox samples.
- The next Youth Taekwondo — Beginners session has 20 booked and 2 waitlisted.
- M4 (AI) demo data — produced by the real jobs and actions with the recorded dev fixtures (no paid calls;
  every AI result shows a "dev fixture" badge until a key is added and the jobs re-run):
  - **Drift Detector**: risk scores for every active student; Riley Adams is #1 (knee injury note, no class in
    ~4 weeks) among ~7 high-risk students, each with a drafted outreach in Approvals.
  - **Action board**: the most recent Youth Taekwondo — Advanced session has a recorded class (a placeholder tone
    whose transcript is a fixture) and a pending board: 9 check-ins + 1 unsure, 3 sign-offs, 1 injury, 1 follow-up.
  - **Doc intake**: a Century packing slip read into a pending receiving draft (Retail → Receive).
  - **Technique feedback**: Maya's practice clip has instructor-released feedback on Home; Leo's waits in Mat → Reviews.
  - **Family updates**: this week's narratives drafted for every active minor who trained; Maya's and Leo's are
    approved and show under "This week" on Home, the rest wait in Approvals (batch-approve them).
  - Knowledge base (4 policies + the schedule digest), lead scores with suggested next steps, schedule
    suggestions on the dashboard, AI budget $50/month (usage shows what was actually spent: $0 for fixtures).

## Harbor BJJ (`harbor`, Core plan only, America/Los_Angeles) — second tenant for isolation tests

| Role | Email |
|---|---|
| Owner | owner@harborbjj.demo |
| Admin | admin@harborbjj.demo |
| Front desk | frontdesk@harborbjj.demo |
| Instructor | instructor@harborbjj.demo |
| Assistant instructor | assistant@harborbjj.demo |
| Parent | parent@harborbjj.demo |
| Student | student@harborbjj.demo |

## Platform

| Role | Email |
|---|---|
| Platform admin | platform@koryograph.demo |

Local mail (magic links, resets) is captured by Mailpit at http://127.0.0.1:54324.
