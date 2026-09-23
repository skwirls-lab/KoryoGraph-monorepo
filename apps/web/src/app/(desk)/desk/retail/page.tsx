import { redirect } from "next/navigation";

// Products, inventory and POS arrive in M2.08–M2.09; until then Retail opens on gear fulfilment.
export default function RetailIndex() {
  redirect("/desk/retail/fulfilment");
}
