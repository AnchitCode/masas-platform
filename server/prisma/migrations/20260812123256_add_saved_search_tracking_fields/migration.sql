-- AlterTable
ALTER TABLE "saved_searches" ADD COLUMN     "last_checked_at" TIMESTAMP(3),
ADD COLUMN     "last_match_at" TIMESTAMP(3);
