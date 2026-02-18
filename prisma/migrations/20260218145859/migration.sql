/*
  Warnings:

  - Added the required column `role` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('organisation_admin', 'team_member', 'user');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" VARCHAR(50) NOT NULL;
