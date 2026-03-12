-- Fix for Bid Room Save Issue
-- The React frontend recently added support for 'deadline', 'submission', and 'admin' work item types,
-- but the database constraint was never updated to allow saving them.
-- Run this in the Supabase SQL Editor to allow saving the new types.

-- Step 1: Remove the old strict rule
ALTER TABLE public.job_work_items 
DROP CONSTRAINT IF EXISTS job_work_items_type_check;

-- Step 2: Add the new expanded rule that matches BidRoomPanel.tsx
ALTER TABLE public.job_work_items 
ADD CONSTRAINT job_work_items_type_check 
CHECK (type IN ('requirement', 'risk', 'clarification', 'outline', 'deadline', 'submission', 'admin'));
