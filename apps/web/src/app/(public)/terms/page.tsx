import Link from "next/link";
import { LegalPage } from "@/components/site/legal-page";

export const metadata = { title: "Terms", description: "Terms of service for schools using KoryoGraph (draft).", alternates: { canonical: "/terms" } };

export default function Terms() {
  return (
    <LegalPage title="Terms of service" updated="September 2026">
      <h2>The service</h2>
      <p>KoryoGraph provides software for running a martial arts school. The school&apos;s owner accepts these terms for the school and is responsible for who they invite and what their staff do in the app.</p>
      <h2>Trial, plans and billing</h2>
      <ul>
        <li>New schools get a 14-day trial with every module. No card is needed to start.</li>
        <li>After the trial the school chooses a plan or modules; prices are shown on the <Link href="/pricing">pricing page</Link>. AI usage is metered against a monthly budget the school sets.</li>
        <li>Plans renew monthly or annually until cancelled. Cancelling stops the next renewal.</li>
      </ul>
      <h2>Payments to the school</h2>
      <p>Families pay the school, not KoryoGraph. Payments are processed by Stripe through the school&apos;s own Stripe account, under Stripe&apos;s terms.</p>
      <h2>Your data</h2>
      <p>The school owns its data. It can export everything at any time, and we delete it after an account is closed and the export window has passed. See the <Link href="/privacy">privacy page</Link>.</p>
      <h2>Acceptable use</h2>
      <p>Don&apos;t use KoryoGraph to send messages people haven&apos;t agreed to receive, to upload content you don&apos;t have the rights to, or to try to reach another school&apos;s data.</p>
      <h2>Changes and contact</h2>
      <p>We&apos;ll tell account owners before these terms change in a way that matters. Questions: <Link href="/contact">contact us</Link>.</p>
    </LegalPage>
  );
}
