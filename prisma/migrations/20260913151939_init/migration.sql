-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'blocked');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('buyer', 'supplier', 'contractor', 'supervisor', 'admin');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('ru', 'kk');

-- CreateEnum
CREATE TYPE "LegalType" AS ENUM ('ip', 'too', 'self_employed');

-- CreateEnum
CREATE TYPE "CompanyRole" AS ENUM ('supplier', 'contractor', 'buyer');

-- CreateEnum
CREATE TYPE "Scale" AS ENUM ('individual', 'small', 'medium', 'large');

-- CreateEnum
CREATE TYPE "TaxStatus" AS ENUM ('vat_payer', 'non_vat', 'simplified');

-- CreateEnum
CREATE TYPE "MemberPermission" AS ENUM ('owner', 'manager', 'estimator');

-- CreateEnum
CREATE TYPE "VerificationDocType" AS ENUM ('license', 'attestation', 'bin', 'registration');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "ExternalPlatform" AS ENUM ('twogis', 'instagram', 'other');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('draft', 'active', 'paused', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "RequestMode" AS ENUM ('matched', 'direct', 'broadcast');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('draft', 'published', 'needs_dispatcher', 'expired', 'cancelled', 'closed');

-- CreateEnum
CREATE TYPE "LeadOrigin" AS ENUM ('matched', 'direct', 'broadcast', 'rematch', 'dispatcher');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('offered', 'declined', 'purchased', 'refunded');

-- CreateEnum
CREATE TYPE "PitchStatus" AS ENUM ('sent', 'viewed', 'accepted', 'declined', 'expired');

-- CreateEnum
CREATE TYPE "OfferScope" AS ENUM ('material_and_work', 'material_only', 'install_only');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('draft', 'sent', 'declined', 'not_selected', 'accepted', 'expired');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('created', 'awaiting_payment', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "CancelPolicy" AS ENUM ('full_refund_before_start', 'partial_after_start', 'no_refund');

-- CreateEnum
CREATE TYPE "DealItemPortion" AS ENUM ('material', 'install', 'delivery');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('pending', 'funded', 'in_progress', 'submitted', 'accepted', 'partially_accepted', 'rejected');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('held', 'released', 'refunded');

-- CreateEnum
CREATE TYPE "ActType" AS ENUM ('acceptance', 'reconciliation', 'supervisor_conclusion');

-- CreateEnum
CREATE TYPE "ActStatus" AS ENUM ('draft', 'signed', 'disputed');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('open', 'in_review', 'resolved', 'rejected');

-- CreateEnum
CREATE TYPE "DisputeCategory" AS ENUM ('quality', 'deadline', 'payment', 'lead_refund', 'act_unsigned', 'other');

-- CreateEnum
CREATE TYPE "WarrantyStatus" AS ENUM ('open', 'in_progress', 'resolved', 'rejected');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('personal_data', 'marketing');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('in_app', 'push', 'sms', 'whatsapp', 'email');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('credit', 'debit', 'hold', 'release', 'commission', 'lead_purchase', 'payout', 'refund');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('pending', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('lead', 'milestone', 'subscription');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'retry_pending', 'succeeded', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('pending', 'approved', 'completed', 'rejected');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('free', 'basic', 'pro');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'past_due', 'cancelled');

-- CreateEnum
CREATE TYPE "ReviewAuthorRole" AS ENUM ('buyer', 'supervisor');

-- CreateEnum
CREATE TYPE "ReviewDisputeStatus" AS ENUM ('open', 'resolved', 'rejected');

-- CreateEnum
CREATE TYPE "RatingTargetType" AS ENUM ('company', 'user');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('number', 'text', 'select', 'multiselect', 'boolean', 'file');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('plan', 'photo', 'document', 'voice', 'other');

-- CreateEnum
CREATE TYPE "LabReportType" AS ENUM ('concrete', 'soil', 'water', 'electrical', 'other');

-- CreateEnum
CREATE TYPE "CommissioningStatus" AS ENUM ('not_started', 'in_progress', 'commissioned');

-- CreateEnum
CREATE TYPE "ResponsibilityLevel" AS ENUM ('I', 'II', 'III');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "alt_email" TEXT,
    "name" TEXT,
    "locale" "Locale" NOT NULL DEFAULT 'ru',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "referral_code" TEXT NOT NULL,
    "referred_by" TEXT,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_attempts" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_attempt_at" TIMESTAMP(3),

    CONSTRAINT "otp_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_change_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "old_phone" TEXT NOT NULL,
    "new_phone" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_change_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" TEXT NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "user_id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "digest_mode" BOOLEAN NOT NULL DEFAULT false,
    "quiet_hours_start" INTEGER,
    "quiet_hours_end" INTEGER,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id","channel")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "consent_type" "ConsentType" NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "legal_type" "LegalType" NOT NULL,
    "name" TEXT NOT NULL,
    "bin" TEXT NOT NULL,
    "bank_account" TEXT,
    "registration_doc_url" TEXT,
    "role" "CompanyRole" NOT NULL,
    "scale" "Scale" NOT NULL DEFAULT 'small',
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "public_slug" TEXT NOT NULL,
    "region" TEXT,
    "city" TEXT,
    "service_regions_json" JSONB NOT NULL DEFAULT '[]',
    "service_area_polygon" JSONB,
    "service_center_lat" DOUBLE PRECISION,
    "service_center_lng" DOUBLE PRECISION,
    "service_radius_km" DOUBLE PRECISION,
    "categories_json" JSONB NOT NULL DEFAULT '[]',
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "portfolio_json" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT,
    "tax_status" "TaxStatus" NOT NULL DEFAULT 'non_vat',
    "daily_lead_limit" INTEGER NOT NULL DEFAULT 5,
    "pitch_daily_limit" INTEGER NOT NULL DEFAULT 5,
    "pitch_cooldown_days" INTEGER NOT NULL DEFAULT 7,
    "soft_banned_until" TIMESTAMP(3),
    "soft_ban_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_members" (
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "permission" "MemberPermission" NOT NULL DEFAULT 'manager',

    CONSTRAINT "company_members_pkey" PRIMARY KEY ("user_id","company_id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "category_id" TEXT,
    "doc_type" "VerificationDocType" NOT NULL,
    "doc_url" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'pending',
    "valid_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_profiles" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "platform" "ExternalPlatform" NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "external_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_reputation" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "avg_rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deals_count" INTEGER NOT NULL DEFAULT 0,
    "on_time_pct" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "disputes_open" INTEGER NOT NULL DEFAULT 0,
    "disputes_closed" INTEGER NOT NULL DEFAULT 0,
    "ai_summary_praise" TEXT,
    "ai_summary_complaints" TEXT,
    "ai_summary_incidents" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_reputation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_kk" TEXT NOT NULL,
    "parent_id" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "object_types" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_kk" TEXT NOT NULL,
    "is_renovation" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "object_types_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "regulatory_rules" (
    "id" TEXT NOT NULL,
    "object_type" TEXT,
    "construction_type" TEXT,
    "min_area" DOUBLE PRECISION,
    "max_area" DOUBLE PRECISION,
    "min_floors" INTEGER,
    "responsibility_level" "ResponsibilityLevel" NOT NULL,
    "needs_permit" BOOLEAN NOT NULL,
    "needs_expertise" BOOLEAN NOT NULL,
    "needs_tech_supervision" BOOLEAN NOT NULL,
    "note" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "regulatory_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_kk" TEXT NOT NULL,
    "object_types_json" JSONB NOT NULL DEFAULT '[]',
    "parent_id" TEXT,
    "required_license" BOOLEAN NOT NULL DEFAULT false,
    "required_attestation" BOOLEAN NOT NULL DEFAULT false,
    "seasonal_restrictions_json" JSONB,
    "order_index" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_templates" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_parameters" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "label_kk" TEXT,
    "field_type" "FieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options_json" JSONB,
    "unit" TEXT,
    "hint" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "request_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_typical_duration" (
    "id" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "construction_type" TEXT,
    "stage_name" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "typical_days" INTEGER NOT NULL,
    "category_code" TEXT,

    CONSTRAINT "stage_typical_duration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_tiers" (
    "id" TEXT NOT NULL,
    "min_amount" DECIMAL(14,2) NOT NULL,
    "max_amount" DECIMAL(14,2),
    "percent" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "commission_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_reference" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "price_min" DECIMAL(14,2) NOT NULL,
    "price_avg" DECIMAL(14,2) NOT NULL,
    "price_max" DECIMAL(14,2) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_reference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acceptance_checklists" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "item_text" TEXT NOT NULL,
    "item_text_kk" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "photo_required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "acceptance_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "company_id" TEXT,
    "parent_project_id" TEXT,
    "name" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "construction_type" TEXT,
    "region" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT,
    "address" TEXT,
    "geo_lat" DOUBLE PRECISION,
    "geo_lng" DOUBLE PRECISION,
    "area" DOUBLE PRECISION,
    "rooms" INTEGER,
    "floor" INTEGER,
    "floors" INTEGER,
    "stage" TEXT,
    "deadline" TIMESTAMP(3),
    "budget_min" DECIMAL(14,2),
    "budget_max" DECIMAL(14,2),
    "open_to_pitches" BOOLEAN NOT NULL DEFAULT false,
    "land_purpose" TEXT,
    "seismicity" INTEGER,
    "responsibility_level" "ResponsibilityLevel",
    "needs_permit" BOOLEAN,
    "needs_expertise" BOOLEAN,
    "needs_tech_supervision" BOOLEAN,
    "tu_electric" BOOLEAN NOT NULL DEFAULT false,
    "tu_gas" BOOLEAN NOT NULL DEFAULT false,
    "tu_water" BOOLEAN NOT NULL DEFAULT false,
    "tu_sewer" BOOLEAN NOT NULL DEFAULT false,
    "tu_heat" BOOLEAN NOT NULL DEFAULT false,
    "commissioning_status" "CommissioningStatus" NOT NULL DEFAULT 'not_started',
    "status" "ProjectStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_files" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" "FileType" NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "size_bytes" INTEGER,
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "permission" "MemberPermission" NOT NULL DEFAULT 'manager',

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("project_id","user_id")
);

-- CreateTable
CREATE TABLE "construction_stages" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT true,
    "progress_pct" INTEGER NOT NULL DEFAULT 0,
    "category_code" TEXT,

    CONSTRAINT "construction_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_schedule" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "planned_start" TIMESTAMP(3),
    "planned_end" TIMESTAMP(3),
    "predicted_next_need_category_id" TEXT,
    "predicted_date" TIMESTAMP(3),
    "actual_date" TIMESTAMP(3),
    "lead_time_days" INTEGER NOT NULL DEFAULT 14,
    "notified_at" TIMESTAMP(3),

    CONSTRAINT "stage_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_dependencies" (
    "stage_id" TEXT NOT NULL,
    "depends_on_stage_id" TEXT NOT NULL,

    CONSTRAINT "stage_dependencies_pkey" PRIMARY KEY ("stage_id","depends_on_stage_id")
);

-- CreateTable
CREATE TABLE "requests" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "stage_id" TEXT,
    "category_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "template_version" INTEGER NOT NULL,
    "mode" "RequestMode" NOT NULL DEFAULT 'matched',
    "values_json" JSONB NOT NULL DEFAULT '{}',
    "ai_extracted_json" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "RequestStatus" NOT NULL DEFAULT 'draft',
    "radius_expanded" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_batches" (
    "id" TEXT NOT NULL,
    "created_by_company_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "filter_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_batch_items" (
    "batch_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,

    CONSTRAINT "request_batch_items_pkey" PRIMARY KEY ("batch_id","request_id")
);

-- CreateTable
CREATE TABLE "supplier_pitches" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "price_estimate" DECIMAL(14,2),
    "status" "PitchStatus" NOT NULL DEFAULT 'sent',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_pitches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "origin" "LeadOrigin" NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'offered',
    "purchased_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "threads" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachments_json" JSONB NOT NULL DEFAULT '[]',
    "flagged_contact_leak" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "payload_json" JSONB NOT NULL DEFAULT '{}',
    "dedup_key" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "deferred_until" TIMESTAMP(3),
    "digest_batch_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "offer_scope" "OfferScope" NOT NULL DEFAULT 'material_and_work',
    "material_json" JSONB NOT NULL DEFAULT '[]',
    "attachments_json" JSONB NOT NULL DEFAULT '[]',
    "material_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "work_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "delivery_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "delivery_days" INTEGER,
    "execution_days" INTEGER,
    "warranty" TEXT,
    "total" DECIMAL(14,2) NOT NULL,
    "matches_params" BOOLEAN NOT NULL DEFAULT true,
    "mismatch_notes" TEXT,
    "suspicious_cheap" BOOLEAN NOT NULL DEFAULT false,
    "valid_until" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "OfferStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_templates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template_values_json" JSONB NOT NULL,

    CONSTRAINT "offer_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "buyer_company_id" TEXT,
    "seller_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KZT',
    "commission_percent" DECIMAL(5,2) NOT NULL,
    "commission_amount" DECIMAL(14,2) NOT NULL,
    "penalty_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "penalty_pct_per_day" DECIMAL(5,2) NOT NULL DEFAULT 0.1,
    "cancel_policy" "CancelPolicy" NOT NULL DEFAULT 'full_refund_before_start',
    "work_started_at" TIMESTAMP(3),
    "status" "DealStatus" NOT NULL DEFAULT 'created',
    "flagged_suspicious" BOOLEAN NOT NULL DEFAULT false,
    "contacts_revealed" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_items" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "portion" "DealItemPortion" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "deal_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "accepted_amount" DECIMAL(14,2),
    "due_date" TIMESTAMP(3),
    "status" "MilestoneStatus" NOT NULL DEFAULT 'pending',
    "submitted_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_holds" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "milestone_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "EscrowStatus" NOT NULL DEFAULT 'held',
    "provider_ref" TEXT,
    "blocked_by_dispute_id" TEXT,
    "released_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escrow_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acts" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "act_type" "ActType" NOT NULL,
    "milestone_id" TEXT,
    "file_url" TEXT,
    "content_html" TEXT,
    "signed_by_buyer_at" TIMESTAMP(3),
    "signed_by_seller_at" TIMESTAMP(3),
    "buyer_signature_ref" TEXT,
    "seller_signature_ref" TEXT,
    "sign_deadline_at" TIMESTAMP(3),
    "status" "ActStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_results" (
    "id" TEXT NOT NULL,
    "milestone_id" TEXT NOT NULL,
    "checklist_item_id" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "photo_url" TEXT,
    "checked_by" TEXT,

    CONSTRAINT "checklist_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "milestone_id" TEXT,
    "opened_by" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "category" "DisputeCategory" NOT NULL DEFAULT 'other',
    "status" "DisputeStatus" NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranty_claims" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "photo_url" TEXT,
    "status" "WarrantyStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "warranty_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_reports" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "lab_name" TEXT NOT NULL,
    "report_type" "LabReportType" NOT NULL,
    "file_url" TEXT,
    "verdict_summary" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_parses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT,
    "category_id" TEXT,
    "input_kind" TEXT NOT NULL,
    "sent_prompt" TEXT NOT NULL,
    "result_json" JSONB,
    "provider" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_parses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'KZT',

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KZT',
    "provider" TEXT,
    "provider_ref" TEXT,
    "idempotency_key" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'succeeded',
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT,
    "lead_id" TEXT,
    "milestone_id" TEXT,
    "payer_id" TEXT NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KZT',
    "provider" TEXT NOT NULL,
    "provider_ref" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "reconciled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_requests" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "bank_account" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "payout_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'month',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "next_billing_at" TIMESTAMP(3),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "author_role" "ReviewAuthorRole" NOT NULL DEFAULT 'buyer',
    "target_company_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "photo_urls_json" JSONB NOT NULL DEFAULT '[]',
    "flagged_suspicious" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_responses" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_disputes" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "opened_by_company_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReviewDisputeStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "target_type" "RatingTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "meta_json" JSONB,
    "previous_hash" TEXT,
    "hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- CreateIndex
CREATE INDEX "otp_codes_phone_idx" ON "otp_codes"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "otp_attempts_phone_key" ON "otp_attempts"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_user_id_token_key" ON "device_tokens"("user_id", "token");

-- CreateIndex
CREATE UNIQUE INDEX "companies_bin_key" ON "companies"("bin");

-- CreateIndex
CREATE UNIQUE INDEX "companies_public_slug_key" ON "companies"("public_slug");

-- CreateIndex
CREATE INDEX "verifications_company_id_category_id_status_idx" ON "verifications"("company_id", "category_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "company_reputation_company_id_key" ON "company_reputation"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "regions_code_key" ON "regions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "categories_code_key" ON "categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "request_templates_category_id_version_key" ON "request_templates"("category_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "request_parameters_template_id_key_key" ON "request_parameters"("template_id", "key");

-- CreateIndex
CREATE INDEX "projects_owner_id_idx" ON "projects"("owner_id");

-- CreateIndex
CREATE INDEX "projects_open_to_pitches_status_idx" ON "projects"("open_to_pitches", "status");

-- CreateIndex
CREATE INDEX "requests_status_idx" ON "requests"("status");

-- CreateIndex
CREATE INDEX "supplier_pitches_company_id_created_at_idx" ON "supplier_pitches"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "leads_company_id_status_idx" ON "leads"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "leads_request_id_company_id_key" ON "leads"("request_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "threads_request_id_seller_id_key" ON "threads"("request_id", "seller_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_idx" ON "notifications"("user_id", "read");

-- CreateIndex
CREATE INDEX "notifications_user_id_dedup_key_idx" ON "notifications"("user_id", "dedup_key");

-- CreateIndex
CREATE INDEX "offers_request_id_status_idx" ON "offers"("request_id", "status");

-- CreateIndex
CREATE INDEX "deals_seller_id_idx" ON "deals"("seller_id");

-- CreateIndex
CREATE INDEX "deals_buyer_id_idx" ON "deals"("buyer_id");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_results_milestone_id_checklist_item_id_key" ON "checklist_results"("milestone_id", "checklist_item_id");

-- CreateIndex
CREATE INDEX "disputes_milestone_id_status_idx" ON "disputes"("milestone_id", "status");

-- CreateIndex
CREATE INDEX "ai_parses_user_id_created_at_idx" ON "ai_parses"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_company_id_key" ON "wallets"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_idempotency_key_key" ON "transactions"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_deal_id_author_id_key" ON "reviews"("deal_id", "author_id");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_deal_id_author_id_target_type_target_id_key" ON "ratings"("deal_id", "author_id", "target_type", "target_id");

-- CreateIndex
CREATE INDEX "activity_log_entity_type_entity_id_idx" ON "activity_log"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "phone_change_log" ADD CONSTRAINT "phone_change_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_profiles" ADD CONSTRAINT "external_profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_reputation" ADD CONSTRAINT "company_reputation_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_templates" ADD CONSTRAINT "request_templates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_parameters" ADD CONSTRAINT "request_parameters_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "request_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_reference" ADD CONSTRAINT "price_reference_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acceptance_checklists" ADD CONSTRAINT "acceptance_checklists_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_parent_project_id_fkey" FOREIGN KEY ("parent_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "construction_stages" ADD CONSTRAINT "construction_stages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_schedule" ADD CONSTRAINT "stage_schedule_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_schedule" ADD CONSTRAINT "stage_schedule_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "construction_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_dependencies" ADD CONSTRAINT "stage_dependencies_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "construction_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_dependencies" ADD CONSTRAINT "stage_dependencies_depends_on_stage_id_fkey" FOREIGN KEY ("depends_on_stage_id") REFERENCES "construction_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "construction_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "request_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_batches" ADD CONSTRAINT "request_batches_created_by_company_id_fkey" FOREIGN KEY ("created_by_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_batches" ADD CONSTRAINT "request_batches_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_batch_items" ADD CONSTRAINT "request_batch_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "request_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_batch_items" ADD CONSTRAINT "request_batch_items_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_pitches" ADD CONSTRAINT "supplier_pitches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_pitches" ADD CONSTRAINT "supplier_pitches_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_pitches" ADD CONSTRAINT "supplier_pitches_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threads" ADD CONSTRAINT "threads_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_templates" ADD CONSTRAINT "offer_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_templates" ADD CONSTRAINT "offer_templates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_buyer_company_id_fkey" FOREIGN KEY ("buyer_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_items" ADD CONSTRAINT "deal_items_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_items" ADD CONSTRAINT "deal_items_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_holds" ADD CONSTRAINT "escrow_holds_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_holds" ADD CONSTRAINT "escrow_holds_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acts" ADD CONSTRAINT "acts_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acts" ADD CONSTRAINT "acts_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_results" ADD CONSTRAINT "checklist_results_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_results" ADD CONSTRAINT "checklist_results_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "acceptance_checklists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_parses" ADD CONSTRAINT "ai_parses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_parses" ADD CONSTRAINT "ai_parses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_target_company_id_fkey" FOREIGN KEY ("target_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_disputes" ADD CONSTRAINT "review_disputes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_disputes" ADD CONSTRAINT "review_disputes_opened_by_company_id_fkey" FOREIGN KEY ("opened_by_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
