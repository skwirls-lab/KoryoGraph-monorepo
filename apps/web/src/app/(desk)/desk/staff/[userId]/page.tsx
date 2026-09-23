import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { ApproveEntryButton, CertForm, DeleteCertButton, PinForm, ProfileForm, TimeEntryForm } from "@/components/staff/staff-forms";
import { CERT_KINDS } from "@/lib/validation/staff";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Staff member" };

const card = "rounded-xl border border-default bg-surface p-4 sm:p-5";

export default async function StaffMemberPage({ params }: { params: Promise<{ userId: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("staff.manage")) forbidden();
  const { userId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) notFound();
  const { data: tu } = await ctx.supabase.from("tenant_users").select("user_id, status, roles(name), profiles(full_name, email)").eq("user_id", userId).maybeSingle();
  if (!tu) notFound();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: ctx.tz }).format(new Date());
  const [{ data: profile }, { data: certs }, { data: entries }, { data: pin }, { data: programs }, { data: commissions }] = await Promise.all([
    ctx.supabase.from("staff_profiles").select("*").eq("user_id", userId).maybeSingle(),
    ctx.supabase.from("staff_certifications").select("id, kind, name, issuer, number, issued_at, expires_at").eq("user_id", userId).order("expires_at", { nullsFirst: false }),
    ctx.supabase.from("time_entries").select("id, clock_in, clock_out, source, approved_at, notes").eq("user_id", userId).order("clock_in", { ascending: false }).limit(20),
    ctx.supabase.from("staff_pins").select("user_id, locked_until").eq("user_id", userId).maybeSingle(),
    ctx.supabase.from("programs").select("id, name").eq("active", true).order("sort"),
    ctx.supabase.from("commissions").select("id, ref_type, base_cents, rate_pct, amount_cents, period, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
  ]);
  const name = tu.profiles?.full_name || tu.profiles?.email || "Staff";
  const rates = (profile?.pay_rates ?? {}) as { hourly_cents?: number; per_class_cents?: number; commission_pct?: number };
  const dollars = (c?: number) => (c ? (c / 100).toFixed(2) : "");
  const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: ctx.tz, dateStyle: "medium", timeStyle: "short" });
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/staff">Staff</Link>} title={name} description={`${tu.roles?.name ?? ""}${profile?.title ? ` · ${profile.title}` : ""}${tu.profiles?.email ? ` · ${tu.profiles.email}` : ""}`} />
      <div className="grid gap-4 xl:grid-cols-2">
        <section className={card} aria-labelledby="profile-h">
          <h2 id="profile-h" className="mb-3 text-base font-semibold">Profile &amp; pay</h2>
          <ProfileForm programs={programs ?? []} initial={{
            userId, title: profile?.title ?? "", programs: profile?.programs ?? [], hourly: dollars(rates.hourly_cents), perClass: dollars(rates.per_class_cents),
            commissionPct: rates.commission_pct ? String(rates.commission_pct) : "", hireDate: profile?.hire_date ?? "", bio: profile?.bio ?? "",
          }} />
        </section>
        <div className="space-y-4">
          <section className={card} aria-labelledby="certs-h">
            <h2 id="certs-h" className="mb-3 text-base font-semibold">Certifications</h2>
            {certs?.length ? (
              <ul className="mb-4 divide-y divide-default text-sm" aria-label="Certifications">
                {certs.map((c) => {
                  const label = c.name || CERT_KINDS[c.kind as keyof typeof CERT_KINDS] || c.kind;
                  const expired = c.expires_at !== null && c.expires_at < today;
                  return (
                    <li key={c.id} aria-label={label} className="flex flex-wrap items-center gap-2 py-2">
                      <span className="font-medium">{label}</span>
                      <span className="text-xs text-fg-muted">{[c.issuer, c.number].filter(Boolean).join(" · ")}</span>
                      {c.expires_at ? <Badge variant={expired ? "destructive" : "outline"} className="ml-auto">{expired ? "Expired" : "Expires"} {c.expires_at}</Badge> : <span className="ml-auto text-xs text-fg-muted">no expiry</span>}
                      <DeleteCertButton id={c.id} name={label} />
                    </li>
                  );
                })}
              </ul>
            ) : <p className="mb-3 text-sm text-fg-muted">None on file.</p>}
            <CertForm userId={userId} />
          </section>
          <section className={card} aria-labelledby="pin-h">
            <h2 id="pin-h" className="mb-3 text-base font-semibold">Kiosk time clock</h2>
            <p className="mb-2 text-sm text-fg-secondary">{pin ? (pin.locked_until && new Date(pin.locked_until) > new Date() ? "PIN locked after too many attempts — setting a new one unlocks it." : "PIN set.") : "No PIN yet — they can't clock in at the kiosk."}</p>
            <PinForm userId={userId} hasPin={Boolean(pin)} />
          </section>
        </div>
        <section className={card} aria-labelledby="time-h">
          <h2 id="time-h" className="mb-3 text-base font-semibold">Time entries</h2>
          {entries?.length ? (
            <ul className="mb-4 divide-y divide-default text-sm" aria-label="Time entries">
              {entries.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span>{fmt(e.clock_in)} → {e.clock_out ? new Date(e.clock_out).toLocaleTimeString("en-US", { timeZone: ctx.tz, timeStyle: "short" }) : <Badge variant="secondary">clocked in</Badge>}</span>
                  {e.clock_out ? <span className="text-xs text-fg-muted">{((new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3_600_000).toFixed(2)} h</span> : null}
                  <Badge variant="outline">{e.source}</Badge>
                  {e.notes ? <span className="text-xs text-fg-muted">{e.notes}</span> : null}
                  <span className="ml-auto">{e.approved_at ? <span className="text-xs text-fg-muted">approved</span> : e.clock_out ? <ApproveEntryButton id={e.id} /> : null}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mb-3 text-sm text-fg-muted">No time recorded.</p>}
          <TimeEntryForm userId={userId} today={today} />
        </section>
        <section className={card} aria-labelledby="comm-h">
          <h2 id="comm-h" className="mb-3 text-base font-semibold">Recent commissions</h2>
          {commissions?.length ? (
            <ul className="divide-y divide-default text-sm" aria-label="Commissions">
              {commissions.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 py-1.5">
                  <span>{c.ref_type === "pos_sale" ? "Retail sale" : "Membership"}</span>
                  <span className="text-xs text-fg-muted">{Number(c.rate_pct)}% of {formatMoney(c.base_cents, ctx.currency)} · {c.period}</span>
                  <span className="ml-auto font-medium">{formatMoney(c.amount_cents, ctx.currency)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-fg-muted">{rates.commission_pct ? "None yet." : "No commission rate set."}</p>}
        </section>
      </div>
    </>
  );
}
