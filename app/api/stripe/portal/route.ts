import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only the Super Admin (billing owner) may open the billing portal.
  // Regular admins and members do not have billing access.
  if (session.company_role !== "super_admin") {
    return NextResponse.json(
      { error: "Only the account owner can manage billing" },
      { status: 403 }
    );
  }

  if (!session.company_id) {
    return NextResponse.json(
      { error: "No company associated with this account" },
      { status: 400 }
    );
  }

  const supabase = getSupabase();
  const { data: company } = await supabase
    .from("companies")
    .select("stripe_customer_id")
    .eq("id", session.company_id)
    .single();

  if (!company?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing account yet — start a subscription first." },
      { status: 400 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  let portalSession;
  try {
    portalSession = await stripe.billingPortal.sessions.create({
      customer: company.stripe_customer_id,
      return_url: `${baseUrl}/company`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ url: portalSession.url });
}
