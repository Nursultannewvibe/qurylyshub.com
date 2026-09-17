-- CreateEnum
CREATE TYPE "BoardTargetType" AS ENUM ('post', 'reply');

-- CreateEnum
CREATE TYPE "BoardReportStatus" AS ENUM ('open', 'resolved', 'rejected');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "board_post_daily_limit" INTEGER NOT NULL DEFAULT 5;

-- CreateTable
CREATE TABLE "board_posts" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "region_id" TEXT,
    "author_id" TEXT NOT NULL,
    "company_id" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "board_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "board_replies" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "board_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "board_reports" (
    "id" TEXT NOT NULL,
    "target_type" "BoardTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "reported_by" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "BoardReportStatus" NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "board_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "board_posts_category_id_region_id_created_at_idx" ON "board_posts"("category_id", "region_id", "created_at");

-- CreateIndex
CREATE INDEX "board_reports_status_idx" ON "board_reports"("status");

-- AddForeignKey
ALTER TABLE "board_posts" ADD CONSTRAINT "board_posts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_posts" ADD CONSTRAINT "board_posts_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_posts" ADD CONSTRAINT "board_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_posts" ADD CONSTRAINT "board_posts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_replies" ADD CONSTRAINT "board_replies_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "board_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_replies" ADD CONSTRAINT "board_replies_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
