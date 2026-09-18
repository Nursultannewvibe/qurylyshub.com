-- AlterTable
ALTER TABLE "request_links" ADD COLUMN     "primary_deal_id" TEXT,
ALTER COLUMN "primary_request_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "request_links_primary_deal_id_idx" ON "request_links"("primary_deal_id");

-- AddForeignKey
ALTER TABLE "request_links" ADD CONSTRAINT "request_links_primary_deal_id_fkey" FOREIGN KEY ("primary_deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
