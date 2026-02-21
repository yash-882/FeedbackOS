-- CreateEnum
CREATE TYPE "FeedbackResourceType" AS ENUM ('email', 'zendesk', 'slack');

-- CreateEnum
CREATE TYPE "PriorityLevel" AS ENUM ('low', 'medium', 'high', 'very_high');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "email" TEXT NOT NULL,
    "feedback_resources" "FeedbackResourceType"[] DEFAULT ARRAY[]::"FeedbackResourceType"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL  DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "resource_type" "FeedbackResourceType" NOT NULL,
    "content" TEXT NOT NULL,
    "priority" "PriorityLevel" NOT NULL,
    "is_negative" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feedback_summary_id" TEXT NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackSummary" (
    "id" TEXT NOT NULL  DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "ai_summary" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_feedback_summary_id_fkey" FOREIGN KEY ("feedback_summary_id") REFERENCES "FeedbackSummary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackSummary" ADD CONSTRAINT "FeedbackSummary_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
