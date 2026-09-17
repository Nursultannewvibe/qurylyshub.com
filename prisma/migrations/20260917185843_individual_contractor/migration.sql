-- AlterEnum
ALTER TYPE "LegalType" ADD VALUE 'individual_contractor';

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "bin" DROP NOT NULL;
