import { SiteShell } from "@/components/site/site-shell";
import { ContactForm } from "@/components/site/contact-form";

export const metadata = { title: "Contact", description: "Questions, a demo for your school, or help with your account.", alternates: { canonical: "/contact" } };

export default function Contact() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-2xl px-4 py-14">
        <h1 className="text-4xl font-bold">Contact us</h1>
        <p className="mt-3 text-lg text-fg-secondary">Questions, a walkthrough for your school, or help with your account — send us a note.</p>
        <div className="mt-8"><ContactForm /></div>
      </section>
    </SiteShell>
  );
}
