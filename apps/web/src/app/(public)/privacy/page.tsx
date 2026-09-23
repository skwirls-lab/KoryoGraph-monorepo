import Link from "next/link";
import { LegalPage } from "@/components/site/legal-page";

export const metadata = { title: "Privacy", description: "How KoryoGraph handles school, family and student data (draft).", alternates: { canonical: "/privacy" } };

export default function Privacy() {
  return (
    <LegalPage title="Privacy" updated="September 2026">
      <h2>Who is responsible for what</h2>
      <p>Each school that uses KoryoGraph controls the information about its students, families and staff. KoryoGraph processes that information on the school&apos;s behalf to run the service. For questions about your child&apos;s records, contact your school first.</p>
      <h2>What we keep</h2>
      <ul>
        <li>Account details: name, email, and for families the phone numbers and addresses the school records.</li>
        <li>Training records: attendance, ranks, skill sign-offs, notes staff write, signed forms and consents.</li>
        <li>Billing records: invoices and payments. Card numbers are handled by Stripe and never stored by KoryoGraph.</li>
        <li>Messages sent through the app, and a log of changes (who did what, and when).</li>
      </ul>
      <h2>Children and AI</h2>
      <p>Class audio and practice videos of anyone under 18 are only processed by AI with a parent or guardian&apos;s recorded consent, and the database refuses otherwise. AI features draft suggestions; school staff review them before anything reaches a family. AI requests go through our AI provider under a monthly budget the school sets, and each request is logged.</p>
      <h2>Separation between schools</h2>
      <p>Each school&apos;s data is isolated in the database itself: staff at one school cannot see another school&apos;s records.</p>
      <h2>Your choices</h2>
      <ul>
        <li>Schools can export all of their data at any time, and close their account.</li>
        <li>Families can ask their school to correct or delete their records, and can change messaging and media consents.</li>
      </ul>
      <p>To reach us about privacy, use the <Link href="/contact">contact form</Link> and choose &ldquo;Privacy or my data&rdquo;.</p>
    </LegalPage>
  );
}
