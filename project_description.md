🧠 Project Description

Build a full-stack web application using Next.js (App Router) and Supabase to manage the complete academic project workflow in colleges or universities.

There will be three types of users:

Admin

Student

Guide (Teacher)

Each user has a unique dashboard and permissions.
The platform automates project submission, review, evaluation, and communication throughout multiple project phases (called reviews).

⚙️ Tech Stack

Frontend: Next.js 15 + TypeScript + TailwindCSS

Backend: Supabase (PostgreSQL, Auth, Storage, Functions)

Auth: Supabase Auth (Email/password with role metadata)

Storage: Supabase Storage (for PDFs)

Email Notifications: Resend / Nodemailer (for alerts, deadline reminders)

Automation: Supabase Edge Functions or scheduled tasks

👥 User Roles & Permissions
1️⃣ Admin

Belongs to a department.

Can add users (students, guides).

Can define reviews/phases (e.g., Review 1, Review 2) with:

Rubrics (like DFD, ER Diagram)

Deadlines

Max marks and late penalty/day

Can upload previous project topics (PDFs).

The system extracts text from these PDFs and stores it in DB to check for topic repetition when new projects are submitted.

Can view and edit any project or submission.

Can view a department leaderboard showing student ranks by total marks.

Can manage notifications and analytics.

2️⃣ Student

Can register a project (title, description).

The system checks topic similarity with existing topics — if unique, it’s accepted and assigned to a guide based on specialization.

Can upload PDF submissions for each review phase.

System checks PDFs for presence of required rubrics (auto validation).

If valid → accepted temporarily.

If missing → automatically rejected, email sent.

Can view:

Submission status: Accepted / Rejected / Pending

Marks and remarks per review

Leaderboard

Notifications (email + dashboard)

Receives automatic deadline reminders.

3️⃣ Guide (Teacher)

Has a specialization field.

Automatically assigned projects matching specialization.

Can view all student projects under their supervision.

Can review submissions, accept/reject, add remarks, and assign marks.

Can update or override marks before final submission closure.

🧱 Database Schema (Supabase)

Use PostgreSQL tables with these relationships:

Tables:

users (id, name, email, role, department, specialization, created_at)

projects (id, title, description, student_id, guide_id, department, status, created_at, updated_at)

phases (id, name, description, deadline, max_marks, late_penalty_per_day, department, created_by, created_at)

rubrics (id, phase_id, name, description, created_at)

submissions (id, student_id, project_id, phase_id, file_url, submission_date, rubric_check_status, guide_status, remarks, marks_awarded, late_days, created_at)

previous_topics (id, department, title, description, pdf_url, uploaded_by, created_at)

notifications (id, user_id, title, message, is_read, created_at)

leaderboard (VIEW combining submissions + users → total marks per student)

Trigger:
When a new user signs up via Supabase Auth, insert their details into users using metadata fields (name, role, department, specialization).

📁 Project Folder Structure
/app
 ├── layout.tsx
 ├── page.tsx                  → Landing/Login Page
 ├── dashboard/
 │    ├── layout.tsx
 │    ├── admin/
 │    │    ├── page.tsx        → Admin Dashboard
 │    │    ├── users/page.tsx  → Manage Users
 │    │    ├── phases/page.tsx → Add & Manage Reviews
 │    │    ├── rubrics/page.tsx→ Define Rubrics
 │    │    ├── topics/page.tsx → Upload Previous Topics
 │    │    ├── projects/page.tsx → View All Projects
 │    │    ├── leaderboard/page.tsx → Leaderboard
 │    │    └── analytics/page.tsx → Reports/Stats
 │
 │    ├── student/
 │    │    ├── page.tsx         → Student Dashboard
 │    │    ├── project/register.tsx → Register Project
 │    │    ├── submissions/page.tsx → Upload/View Submissions
 │    │    ├── marks/page.tsx   → View Marks
 │    │    ├── notifications/page.tsx → Alerts
 │
 │    ├── guide/
 │    │    ├── page.tsx         → Guide Dashboard
 │    │    ├── assigned/page.tsx → Assigned Projects
 │    │    ├── review/page.tsx   → Evaluate Submissions
 │
 ├── api/
 │    ├── submissions/validate/route.ts  → PDF rubric validation
 │    ├── notifications/send/route.ts    → Email triggers
 │    ├── leaderboard/route.ts           → Fetch leaderboard
 │    └── cron/deadlines/route.ts        → Scheduled deadline reminders

💡 Key Features Summary

✅ Role-based access (Admin / Student / Guide)
✅ Secure login with Supabase Auth
✅ PDF upload and rubric-based validation
✅ Late submission auto penalty
✅ Real-time leaderboard
✅ Auto guide assignment
✅ Email notifications for deadlines, rejections, acceptance
✅ Previous topic plagiarism check (based on text similarity)
✅ Admin analytics and department-based dashboards

🚀 Goal

Generate:

A working Next.js + Supabase app structure

Role-based dashboards

Database integration

API routes for automation (notifications, validations)

Responsive UI using Tailwind