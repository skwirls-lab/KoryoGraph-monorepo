-- Reference data applied by `supabase db reset` (global catalogue only; tenants come from scripts/seed).
-- Prices are placeholders for Alex's input (§2.3); the public pricing page reads these rows.

insert into public.modules (key, name, description, required, sort) values
  ('core', 'Core', 'Tenancy, staff & roles, people & households, programs, ranks & curriculum, scheduling, attendance & kiosk, messaging outbox, standard reports, exports & API.', true, 10),
  ('billing', 'Billing', 'Membership plans & contracts, invoices, autopay, dunning, Home wallet, accounting export.', false, 20),
  ('retail', 'Retail', 'Products, variants & inventory, POS with Stripe Terminal, cash drawer, purchase orders.', false, 30),
  ('grow', 'Grow', 'Lead pipeline, trials, automations, email/SMS campaigns, booking widget, referrals & reviews.', false, 40),
  ('programs_plus', 'Programs+', 'Events, camps, after-school, birthday parties and private lessons.', false, 50),
  ('home', 'Home app', 'Parent & student app: booking, wallet, progress, documents, messaging, pro shop.', false, 60),
  ('intelligence', 'Intelligence', 'AI agents: copilot, drift detector, action board, curriculum builder, document intake, NL reports, billing recovery, parent narratives.', false, 70),
  ('vision', 'Vision', 'Technique video feedback for students.', false, 80),
  ('multi_location', 'Multi-location', 'Locations, cross-location rollups and per-location staff scoping.', false, 90)
on conflict (key) do update set name = excluded.name, description = excluded.description, required = excluded.required, sort = excluded.sort;

insert into public.plans (key, name, description, monthly_cents, annual_cents, is_bundle, public, sort) values
  ('core', 'Core', 'Run the school: people, programs, schedule, attendance, messaging.', 7900, 79000, false, true, 10),
  ('studio', 'Studio', 'Core + Billing + Home app.', 14900, 149000, true, true, 20),
  ('academy', 'Academy', 'Every non-AI module.', 24900, 249000, true, true, 30),
  ('academy_ai', 'Academy AI', 'Everything, including Intelligence and Vision (AI usage metered).', 29900, 299000, true, true, 40)
on conflict (key) do update set name = excluded.name, description = excluded.description, monthly_cents = excluded.monthly_cents,
  annual_cents = excluded.annual_cents, is_bundle = excluded.is_bundle, public = excluded.public, sort = excluded.sort;

insert into public.plan_modules (plan_key, module_key) values
  ('core', 'core'),
  ('studio', 'core'), ('studio', 'billing'), ('studio', 'home'),
  ('academy', 'core'), ('academy', 'billing'), ('academy', 'home'), ('academy', 'retail'), ('academy', 'grow'), ('academy', 'programs_plus'),
  ('academy_ai', 'core'), ('academy_ai', 'billing'), ('academy_ai', 'home'), ('academy_ai', 'retail'), ('academy_ai', 'grow'),
  ('academy_ai', 'programs_plus'), ('academy_ai', 'intelligence'), ('academy_ai', 'vision')
on conflict do nothing;

insert into public.permissions (key, domain, description) values
  ('desk.access', 'surface', 'Open the Desk (staff) surface'),
  ('mat.access', 'surface', 'Open the Mat (instructor) surface'),
  ('home.access', 'surface', 'Open the Home (member) surface'),
  ('people.read', 'people', 'View people and households'),
  ('people.write', 'people', 'Create and edit people and households'),
  ('people.medical.read', 'people', 'View medical notes'),
  ('attendance.write', 'attendance', 'Record attendance and manage bookings'),
  ('curriculum.write', 'curriculum', 'Edit programs, ranks, skills and lesson plans'),
  ('ranks.promote', 'curriculum', 'Promote students, award stripes, sign off skills'),
  ('testing.manage', 'testing', 'Run testing events and scoresheets'),
  ('billing.read', 'billing', 'View invoices, payments and memberships'),
  ('billing.charge', 'billing', 'Take payments and manage memberships'),
  ('billing.refund', 'billing', 'Issue refunds and credits'),
  ('retail.sell', 'retail', 'Use the point of sale'),
  ('inventory.manage', 'retail', 'Manage products, stock and purchase orders'),
  ('crm.manage', 'crm', 'Manage leads, trials and the pipeline'),
  ('comms.send', 'comms', 'Send messages and broadcasts'),
  ('automations.manage', 'comms', 'Edit automations and templates'),
  ('events.manage', 'events', 'Manage events, camps and after-school'),
  ('staff.manage', 'staff', 'Invite staff and manage staff records'),
  ('roles.manage', 'staff', 'Edit roles and permissions'),
  ('settings.manage', 'settings', 'Edit school settings, locations and integrations'),
  ('reports.read', 'reports', 'View dashboards and reports'),
  ('ai.approve', 'ai', 'Approve AI drafts'),
  ('ai.use', 'ai', 'Use AI assistants'),
  ('exports.run', 'data', 'Export data'),
  ('audit.read', 'data', 'View the audit log'),
  ('kiosk.manage', 'attendance', 'Pair and manage kiosk devices')
on conflict (key) do update set domain = excluded.domain, description = excluded.description;
