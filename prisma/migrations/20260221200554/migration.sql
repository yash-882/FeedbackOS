/*
  Warnings:

  - A unique constraint covering the columns `[admin_id]` on the table `Organization` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `admin_id` to the `Organization` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "admin_id" VARCHAR(255) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_admin_id_key" ON "Organization"("admin_id");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
