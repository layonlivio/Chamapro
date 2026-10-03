import Stripe from "stripe";
import { activateProfessionalSubscription, getDb, getProfessionalProfile, saveBillingRecord } from "./db";
import { professionalProfiles } from "../drizzle/schema";
import { eq } from "drizzle-orm";

function getStripe() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret);
}

export async function createProfessionalCheckout(input: {
  userId: number;
  email?: string | null;
  name?: string | null;
  origin: string;
}) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe ainda não foi configurado em Settings → Payment.");
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: input.email ?? undefined,
    client_reference_id: String(input.userId),
    allow_promotion_codes: true,
    line_items: [
      {
        price_data: {
          currency: "brl",
          unit_amount: 2990,
          recurring: { interval: "month" },
          product_data: {
            name: "ChamaPro Pro",
            description: "Mais oportunidades de serviço na sua região.",
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      user_id: String(input.userId),
      customer_email: input.email ?? "",
      customer_name: input.name ?? "",
    },
    success_url: `${input.origin}/profissional?checkout=success`,
    cancel_url: `${input.origin}/profissional?checkout=cancelled`,
  });
  return { url: session.url };
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe não configurado");
  const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET ?? "");
  if (event.id.startsWith("evt_test_")) {
    console.log("[Webhook] Test event detected, returning verification response");
    return { verified: true };
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = Number(session.metadata?.user_id ?? session.client_reference_id);
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
    if (userId) {
      await activateProfessionalSubscription(userId, customerId, subscriptionId);
      const profile = await getProfessionalProfile(userId);
      if (profile) await saveBillingRecord({ professionalId: profile.id, eventType: event.type });
    }
  }

  if (event.type === "invoice.paid" || event.type === "payment_intent.succeeded") {
    const object = event.data.object as Stripe.Invoice | Stripe.PaymentIntent;
    const customerId = typeof object.customer === "string" ? object.customer : object.customer?.id;
    if (customerId) {
      const db = await getDb();
      if (db) {
        const profiles = await db.select().from(professionalProfiles).where(eq(professionalProfiles.stripeCustomerId, customerId)).limit(1);
        const profile = profiles[0];
        if (profile) {
          await saveBillingRecord({
            professionalId: profile.id,
            stripeInvoiceId: event.type === "invoice.paid" ? (object as Stripe.Invoice).id : undefined,
            stripePaymentIntentId: event.type === "payment_intent.succeeded" ? (object as Stripe.PaymentIntent).id : undefined,
            eventType: event.type,
          });
        }
      }
    }
  }

  return { received: true };
}
