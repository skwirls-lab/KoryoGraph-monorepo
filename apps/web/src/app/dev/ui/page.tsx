import { notFound } from "next/navigation";
import { UiShowcase } from "./showcase";

export const metadata = { title: "UI kit" };

/** Dev-only visual check of the design system (M0.05). 404 in production. */
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiShowcase />;
}
