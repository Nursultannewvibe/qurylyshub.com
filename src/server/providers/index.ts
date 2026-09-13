// Абстрактные провайдеры внешних систем. В MVP — единственная реализация-заглушка каждого.
// Реальные интеграции (Kaspi/Halyk/Freedom, банковский эскроу, eGov, SMS/WhatsApp, НУЦ ЭЦП) подключаются
// заменой реализации, интерфейсы остаются.
import { createHash, randomUUID } from "crypto";
import { config } from "../config";

// ───────── Payment ─────────
export type ChargeResult = { ok: true; provider_ref: string } | { ok: false; error: string; retryable: boolean };
export interface PaymentProvider {
  readonly name: string;
  charge(input: { amount: number; currency: string; idempotency_key: string; description: string }): Promise<ChargeResult>;
  refund(input: { provider_ref: string; amount: number }): Promise<ChargeResult>;
  /** Сверка: возвращает статус платежа на стороне провайдера. */
  fetchStatus(provider_ref: string): Promise<"succeeded" | "failed" | "pending" | "unknown">;
  verifyWebhook(headers: Record<string, string | undefined>, body: string): boolean;
}

class MockPaymentProvider implements PaymentProvider {
  readonly name: string;
  private store = new Map<string, "succeeded" | "failed">();
  constructor(name = "mock") { this.name = name; }
  async charge(input: { amount: number; idempotency_key: string }): Promise<ChargeResult> {
    // Идемпотентность на стороне провайдера: тот же ключ → тот же ref.
    const ref = `${this.name}-${createHash("sha1").update(input.idempotency_key).digest("hex").slice(0, 12)}`;
    if (this.store.has(ref)) return this.store.get(ref) === "succeeded" ? { ok: true, provider_ref: ref } : { ok: false, error: "declined", retryable: true };
    if (input.idempotency_key.includes("FAIL_ONCE") && !this.store.has(ref + ":failed-once")) {
      this.store.set(ref + ":failed-once", "failed");
      return { ok: false, error: "gateway timeout (mock)", retryable: true };
    }
    if (config.mockPaymentFailRate > 0 && Math.random() < config.mockPaymentFailRate) return { ok: false, error: "gateway timeout (mock)", retryable: true };
    this.store.set(ref, "succeeded");
    return { ok: true, provider_ref: ref };
  }
  async refund(input: { provider_ref: string }): Promise<ChargeResult> { return { ok: true, provider_ref: input.provider_ref + "-refund" }; }
  async fetchStatus(provider_ref: string) { return this.store.get(provider_ref) ?? (provider_ref.startsWith(this.name) ? "succeeded" : "unknown"); }
  verifyWebhook(headers: Record<string, string | undefined>) { return headers["x-webhook-secret"] === config.paymentWebhookSecret; }
}

const paymentProviders: Record<string, PaymentProvider> = {};
export function getPaymentProvider(name = config.paymentProvider): PaymentProvider {
  // kaspi/halyk/freedom без ключей → мок с соответствующим именем (см. .env.example)
  if (!paymentProviders[name]) paymentProviders[name] = new MockPaymentProvider(name);
  return paymentProviders[name];
}

// ───────── Escrow ─────────
export interface EscrowProvider {
  hold(input: { deal_id: string; milestone_id: string; amount: number }): Promise<{ provider_ref: string }>;
  release(input: { provider_ref: string; amount: number }): Promise<{ ok: boolean }>;
  refund(input: { provider_ref: string; amount: number }): Promise<{ ok: boolean }>;
}
export const escrowProvider: EscrowProvider = {
  async hold(i) { return { provider_ref: `escrow-mock-${i.milestone_id.slice(-6)}-${randomUUID().slice(0, 6)}` }; },
  async release() { return { ok: true }; },
  async refund() { return { ok: true }; },
};

// ───────── Gov registry ─────────
export interface GovRegistryProvider {
  checkBin(bin: string): Promise<{ valid: boolean; name?: string; legal_type?: string }>;
  checkLicense(bin: string, license_no: string): Promise<{ valid: boolean; valid_until?: Date }>;
}
export const govRegistryProvider: GovRegistryProvider = {
  async checkBin(bin) { return { valid: /^\d{12}$/.test(bin) }; },
  async checkLicense(_bin, license_no) { return { valid: license_no.length > 3, valid_until: new Date(Date.now() + 365 * 86400000) }; },
};

// ───────── Notifications ─────────
export type OutboundNotification = { user_id: string; channel: string; type: string; payload: unknown; device_tokens: string[]; phone?: string | null };
export interface NotificationProvider {
  send(n: OutboundNotification): Promise<{ ok: boolean; ref?: string }>;
}
export const sentOutbox: OutboundNotification[] = []; // для тестов/отладки мок-провайдера
export const notificationProvider: NotificationProvider = {
  async send(n) {
    sentOutbox.push(n);
    if (sentOutbox.length > 500) sentOutbox.splice(0, sentOutbox.length - 500);
    if (process.env.NODE_ENV !== "test") console.log(`[notify:${n.channel}] → ${n.user_id} ${n.type}`);
    return { ok: true, ref: randomUUID() };
  },
};

// ───────── Signature (ЭЦП) ─────────
export interface SignatureProvider {
  sign(input: { user_id: string; document_hash: string }): Promise<{ signature_ref: string; signed_at: Date }>;
  verify(signature_ref: string, document_hash: string): Promise<boolean>;
}
export const signatureProvider: SignatureProvider = {
  async sign(i) { return { signature_ref: `mock-sig-${createHash("sha256").update(i.user_id + i.document_hash).digest("hex").slice(0, 16)}`, signed_at: new Date() }; },
  async verify(ref) { return ref.startsWith("mock-sig-"); },
};

// ───────── SMS (OTP) ─────────
export async function sendOtpSms(phone: string, code: string) {
  console.log(`[sms:mock] OTP для ${phone}: ${code}`);
}
