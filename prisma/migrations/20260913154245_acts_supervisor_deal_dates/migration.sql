-- AlterTable
ALTER TABLE "acts" ADD COLUMN     "content_hash" TEXT,
ADD COLUMN     "signed_by_supervisor_at" TIMESTAMP(3),
ADD COLUMN     "supervisor_id" TEXT,
ADD COLUMN     "supervisor_signature_ref" TEXT;

-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "completed_at" TIMESTAMP(3);
