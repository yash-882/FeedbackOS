-- add email check to users table
ALTER TABLE "User"
ADD CONSTRAINT "User_email_check" CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');