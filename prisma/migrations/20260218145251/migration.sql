-- AlterTable
ALTER TABLE "User" ADD COLUMN     "organization_id" VARCHAR(255);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL  DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "zendesk_subdomain" VARCHAR(255),
    "slack_workspace_id" VARCHAR(255),
    "email" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
