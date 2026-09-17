-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('material', 'work', 'logistics');

-- CreateEnum
CREATE TYPE "RequestLinkType" AS ENUM ('delivery');

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "category_type" "CategoryType" NOT NULL DEFAULT 'work';

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "service_route_json" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "request_links" (
    "id" TEXT NOT NULL,
    "primary_request_id" TEXT NOT NULL,
    "linked_request_id" TEXT NOT NULL,
    "link_type" "RequestLinkType" NOT NULL DEFAULT 'delivery',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "request_links_primary_request_id_linked_request_id_key" ON "request_links"("primary_request_id", "linked_request_id");

-- AddForeignKey
ALTER TABLE "request_links" ADD CONSTRAINT "request_links_primary_request_id_fkey" FOREIGN KEY ("primary_request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_links" ADD CONSTRAINT "request_links_linked_request_id_fkey" FOREIGN KEY ("linked_request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
