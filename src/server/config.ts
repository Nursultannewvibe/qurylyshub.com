// Пустые строки в env (типично для панелей хостинга) считаются незаданными.
const str = (k: string, d: string) => process.env[k] || d;
const int = (k: string, d: number) => { const v = process.env[k]; const n = v ? parseInt(v, 10) : NaN; return Number.isFinite(n) ? n : d; };
const num = (k: string, d: number) => { const v = process.env[k]; const n = v ? parseFloat(v) : NaN; return Number.isFinite(n) ? n : d; };

export const config = {
  appUrl: str("APP_URL", "http://localhost:3000"),
  jwtSecret: str("JWT_SECRET", "dev-secret"),
  jwtTtl: str("JWT_TTL", "30d"),
  devOtpCode: process.env.DEV_OTP_CODE || null,
  otpMaxAttempts: 5,
  otpLockMinutes: 15,
  matchMaxRecipients: int("MATCH_MAX_RECIPIENTS", 6),
  fallbackRadiusMultiplier: num("MATCH_FALLBACK_RADIUS_MULTIPLIER", 2),
  leadPriceDefault: num("LEAD_PRICE_DEFAULT", 2000),
  leadAutoRefundHours: int("LEAD_AUTO_REFUND_HOURS", 48),
  offerReminderDays: int("OFFER_REMINDER_DAYS", 3),
  actSignDeadlineDays: int("ACT_SIGN_DEADLINE_DAYS", 5),
  reviewWindowDays: int("REVIEW_WINDOW_DAYS", 30),
  pitchExpiresDays: int("PITCH_EXPIRES_DAYS", 7),
  boardPostDailyLimit: int("BOARD_POST_DAILY_LIMIT", 5),
  productPhotosMax: int("PRODUCT_PHOTOS_MAX", 6),
  aiParseDailyLimit: int("AI_PARSE_DAILY_LIMIT", 10),
  uploadDir: str("UPLOAD_DIR", "./uploads"),
  uploadMaxMb: int("UPLOAD_MAX_MB", 15),
  // "files" — папка UPLOAD_DIR; "inline" — файлы ≤ uploadInlineMaxMb хранятся как data-URL в БД (демо на serverless-хостинге)
  uploadStorage: str("UPLOAD_STORAGE", "files") as "files" | "inline",
  uploadInlineMaxMb: num("UPLOAD_INLINE_MAX_MB", 2),
  get uploadEffectiveMaxMb() { return this.uploadStorage === "inline" ? Math.min(this.uploadInlineMaxMb, this.uploadMaxMb) : this.uploadMaxMb; },
  paymentProvider: str("PAYMENT_PROVIDER", "mock"),
  paymentFallbackProvider: str("PAYMENT_FALLBACK_PROVIDER", "mock"),
  paymentWebhookSecret: str("PAYMENT_WEBHOOK_SECRET", "mock-webhook-secret"),
  mockPaymentFailRate: num("MOCK_PAYMENT_FAIL_RATE", 0),
  schedulerEnabled: (str("SCHEDULER_ENABLED", "1")) === "1",
  schedulerIntervalSec: int("SCHEDULER_INTERVAL_SEC", 60),
  llmModel: str("LLM_MODEL", "claude-sonnet-5"),
  anthropicKey: process.env.ANTHROPIC_API_KEY || null,
  timezone: "Asia/Almaty",
};
