# SCOT IT Academy

SCOT IT Academy is a full-stack enquiry-to-student management system for an academy. It helps staff manage leads, follow-ups, enrollments, student records, fee tracking, reports, and admin access from a single dashboard.

## Overview

The application follows a complete workflow:

1. Capture new enquiries
2. Track candidate details and follow-up dates
3. Update enquiry status and category
4. Convert accepted candidates to students
5. Track fee payments and balances
6. Review dashboard metrics and reports
7. Manage admins and academy settings

This is not just a simple frontend app. It is a working academy CRM with a React frontend and an Express + MySQL backend.

## Tech Stack

- Frontend: React 19, React Router, CRA / react-scripts
- Backend: Node.js + Express
- Database: MySQL
- Auth: JWT + bcrypt
- Reporting / export: XLSX, jsPDF
- HTTP client: Axios

## Project Structure

```text
SCOT-IT-Academy/
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── database.js
│   │   ├── owner-account.js
│   │   ├── reset-owner.js
│   │   ├── server-mysql.js
│   │   ├── server.js
│   │   └── student-fees.js
│   ├── test/
│   │   ├── owner-account.test.js
│   │   └── student-fees.test.js
│   └── data/
│       └── db.json
├── docs/
│   └── login-recovery.md
├── frontend/
│   ├── package.json
│   ├── public/
│   ├── src/
│   │   ├── App.js
│   │   ├── components/
│   │   ├── data/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── styles.css
│   │   └── index.js
│   └── .env
├── README.md
└── .gitignore
```

## Main Features

### Enquiry management
- Add new enquiries
- Search and filter by name, course, mobile, category, and status
- View candidate details
- Update follow-up dates and status
- Manage enquiry lifecycle from initial inquiry to enrollment

### Student management
- Add students from accepted enquiries
- Track student ID, course, fee, due date, join date, and status
- Calculate remaining balance automatically
- Search, filter, export, and review student records

### Fee tracking
- Total fee, paid fee, and balance fee calculations
- Auto calculation of outstanding balance
- Student fee monitoring across records and dashboard summary

### Dashboard and reports
- Academy overview cards
- Enquiry follow-up summaries
- Student and fee metrics
- XLSX export support
- Reporting pages for operational analysis

### Admin and access control
- Owner and admin role handling
- Protected routes and role-based access
- Categories and settings management
- Backend owner reset utility for recovery

## Current App Flow

- Login screen for staff access
- Protected routes after JWT authentication
- Sidebar navigation for dashboard, enquiries, students, follow-ups, reports, admins, and categories
- CRUD flow for enquiries, students, categories, and admins
- Role-based access to owner-only pages like admin and settings management

## Backend API

The backend exposes REST endpoints for:

- Authentication and user login
- Dashboard metrics
- Student records
- Enquiries and follow-ups
- Categories and admin management
- Reports, notifications, and settings

The backend is configured for MySQL and includes JWT authentication and owner account recovery utilities.

## Frontend Behavior

The frontend app includes pages such as:

- Dashboard
- Add Enquiry
- Enquiry List
- Students
- Follow-ups
- Reports
- Admins
- Categories
- Settings

The app is designed as a responsive management dashboard with table layouts, filter controls, forms, status chips, and action buttons.

## Setup

### Prerequisites

- Node.js
- npm
- MySQL server
- A working backend `.env` configuration
- Frontend `.env` for the API URL

### Backend setup

From the `backend` folder:

```bash
npm install
npm start
```

The backend expects environment values such as:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=scot_it_academy
JWT_SECRET=your_secret
OWNER_USERNAME=owner
OWNER_PASSWORD=your_secure_password
```

If needed, you can reset the owner account with:

```bash
npm run owner:reset
```

### Frontend setup

From the `frontend` folder:

```bash
npm install
npm start
```

Frontend environment:

```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_USE_BACKEND=true
```

For deployment or hosted backend, replace the URL with the deployed API base.

## Production / Deployment Notes

- The backend is expected to run as a Node.js service with access to MySQL.
- The frontend uses `REACT_APP_API_URL` and `REACT_APP_USE_BACKEND=true` to talk to the backend API instead of local dummy mode.
- The repo includes a document for login recovery and owner account reset in [docs/login-recovery.md](docs/login-recovery.md).

## Testing

Backend tests are available in the `backend/test` folder.

```bash
cd backend
npm test
```

Frontend tests are also present for some key pages, for example `Students.test.js`.

```bash
cd frontend
npx react-scripts test --watchAll=false --runInBand
```

## Notes

This project is currently configured as an academy CRM with all core admin workflows implemented across the frontend and backend. The codebase is organized around data-driven pages, simplified state management, and role-aware access control.

## Summary

SCOT IT Academy is a complete enquiry, follow-up, admission, student, and fee management system designed for academy operations. It combines a React frontend for staff workflows with a MySQL-backed Express API to support real academic administration tasks.

Course
Next Follow-up
Status

So your dashboard can be thought of as:

┌─────────────────────────────────────────┐
│ Dashboard                               │
├────────────┬────────────┬───────────────┤
│ Students   │ Joined     │ Total Fee     │
│    50      │    25      │ ₹5,00,000     │
├────────────┴────────────┴───────────────┤
│ Recent Enquiries                         │
├─────────────────────────────────────────┤
│ Follow-ups                               │
├─────────────────────────────────────────┤
│ Category Statistics                      │
└─────────────────────────────────────────┘
7. Add Enquiry

This is one of the most important pages.

When someone contacts SCOT IT Academy, staff creates an enquiry.

Typical information includes:

Branch
Admin
Enquiry Date
Candidate Name
Mobile
City
Degree
Passed Year
Category
Course
Comments
Next Follow-up Date
Status
Referred By
Referral Contact

The backend accepts these fields when creating an enquiry.

Example:

Branch: Keelkattalai
Admin: Bhuvaneshwari
Candidate: Arun
Mobile: 9876543210
City: Chennai
Degree: BCA
Passed Year: 2025
Category: Development
Course: Python Full Stack
Comments: Interested in weekend batch
Follow-up: 2026-09-12
Status: Positive
Referred By: Google

Then:

POST /api/enquiries

The backend saves it into MySQL.

8. Enquiry List

The Enquiry List displays all enquiries.

Example:

Candidate	Mobile	Course	Status	Follow-up
Arun	9876543210	Python Full Stack	Positive	12 Sep
Kumar	9876501234	Testing	Pending	13 Sep
Priya	9876512345	Data Analytics	Low	15 Sep

The backend endpoint is:

GET /api/enquiries

It returns enquiry information such as branch, admin, candidate, mobile, category, course, status and follow-up dates.

9. Edit Enquiry

Staff should be able to edit an enquiry.

For example:

Status:
Pending → Positive

Follow-up:
12 Sep → 15 Sep

Course:
Python → Python Full Stack

The backend updates fields including:

branch
admin
enquiry_date
candidate_name
mobile
city
degree
passed_year
category
course
comments
next_followup_date
status
referred_by
referral_contact

10. Follow-ups

The Follow-ups page is used by staff to know:

"Who should I contact today?"

The backend provides:

GET /api/follow-ups

It retrieves enquiries that are not Joined, sorted according to follow-up date.

Example:

TODAY'S FOLLOW-UPS

1. Arun
   Python Full Stack
   9876543210
   Follow-up: Today
   Status: Positive

2. Priya
   Data Analytics
   9876500000
   Follow-up: Today
   Status: Pending

This is essentially the CRM's daily task list.

11. Enquiry Status

Your system uses enquiry status to track the candidate journey.

For example:

Positive
Pending
Low
Hold
Negative
Joined

The important transition is:

New
 ↓
Pending
 ↓
Positive
 ↓
Joined

or:

New
 ↓
Pending
 ↓
Low

or:

New
 ↓
Positive
 ↓
Negative

When a candidate becomes Joined, they move into the student/admission side of the system.

The dashboard itself counts joined students using the joined status.

12. Students

The Students page contains people who have actually joined a course.

Typical information:

Student ID
Name
Course
Total Fee
Paid Fee
Balance
Due Date
Action

The system can therefore track:

Total Fee = ₹30,000

Paid = ₹15,000

Balance = ₹15,000

So:

Student
   ↓
Course
   ↓
Total Fee
   ↓
Paid Fee
   ↓
Balance Fee
   ↓
Due Date

The backend also uses student fee data for reports and dashboard calculations.

13. Student Details Modal

The README specifically mentions a student-details modal.

Instead of navigating to another page, clicking a student can open:

┌─────────────────────────────────┐
│ Student Details             X   │
├─────────────────────────────────┤
│ Student ID: ST001               │
│ Name: Arun                      │
│ Mobile: 9876543210              │
│ Course: Python Full Stack       │
│ Total Fee: ₹30,000              │
│ Paid: ₹20,000                   │
│ Balance: ₹10,000                │
│ Due Date: 20 Sep 2026           │
└─────────────────────────────────┘

This keeps the interface faster for staff.

14. Reports

Reports give management a bigger picture.

The backend has:

GET /api/reports

It calculates:

Total Students
Total Enquiries
Total Revenue
Total Due
Category statistics

The backend calculates total revenue using students.total_fee and total outstanding using students.balance_fee.

So management can understand:

Total Enquiries       250
Total Students        100
Total Revenue         ₹25,00,000
Total Pending Fee     ₹4,50,000
15. Categories

Categories classify enquiries/courses.

Examples from your project:

Testing
Cloud
Development
Oracle SQL
UI/UX
Data Analytics
Data Science
Fresher Placement
Experienced Placement
Documents

The backend provides:

GET /api/categories

and:

POST /api/categories

Categories are stored in the categories table and returned ordered by name.

This means you don't need to hard-code every category permanently in React.

16. Admins

The Admins page is for managing staff accounts.

Example:

Admin Name       Username       Status
---------------------------------------
Praveen          praveen        Active
Bhuvaneshwari    bhuvana        Active
Kokila           kokila         Active
Dhana            dhana          Active
Swathy           swathy         Active

Owner can:

Create Admin
Edit Admin
Delete Admin

Admin passwords are stored as bcrypt hashes when updated.

17. Refer By

This page manages referral sources.

For example:

Google
Instagram
Facebook
WhatsApp
Friend
Existing Student
Walk-in
Website
Justdial

When an enquiry comes in:

Candidate: Arun
Referred By: Google

The system can therefore measure which sources generate enquiries.

The enquiry database includes both:

referred_by
referral_contact

fields.

18. Settings

Settings controls academy-level configuration.

The backend provides:

GET /api/settings

and:

PATCH /api/settings

Settings are stored in a MySQL settings table using:

setting_key
setting_value
updated_at

Conceptually:

Settings
│
├── Institute Name
├── Contact Information
├── Email
├── Branch
├── Notification Settings
└── Other Application Configuration
19. Notifications

The system also has a notifications API:

GET /api/notifications

The backend checks students who have:

due_date < today
AND
balance_fee > 0

These are returned as due-fee notifications.

So the application can show something like:

🔔 Notifications

3 students have pending fees

• Arun - ₹10,000
• Priya - ₹5,000
• Kumar - ₹8,000
20. Database Structure

The overall database concept is approximately:

users
│
├── Owner
└── Admins

categories
│
└── Course Categories

enquiries
│
├── Candidate information
├── Follow-up information
├── Status
└── Referral information

students
│
├── Student information
├── Course
├── Fees
└── Due date

settings
│
└── Academy configuration

notifications
│
└── Due/payment notifications

The backend source confirms tables such as settings and notifications, including notification links to students.

21. Complete User Flow

This is the most important part of understanding the whole website.

Step 1 — Login
Owner/Admin
     ↓
Login
     ↓
JWT
     ↓
Dashboard
Step 2 — New candidate
Phone/WhatsApp/Website/Walk-in
             ↓
        Add Enquiry
Step 3 — Enquiry created
Candidate
Course
Category
Mobile
Branch
Admin
Follow-up Date
Status
Step 4 — Follow-up
Follow-up Page
       ↓
Call candidate
       ↓
Update status
       ↓
Set next follow-up
Step 5 — Candidate joins
Positive
   ↓
Joined
   ↓
Student
Step 6 — Fee management
Total Fee
   ↓
Paid Fee
   ↓
Balance Fee
   ↓
Due Date
Step 7 — Management
Dashboard
   +
Reports
   +
Notifications
22. API Architecture

Your current backend follows this pattern:

React
  │
  │ Axios
  ↓
Express API
  │
  ├── Authentication
  ├── Authorization
  ├── Business Logic
  ↓
MySQL

Example:

React
  │
  │ GET /api/enquiries
  ↓
Express
  │
  │ JWT authentication
  ↓
MySQL
  │
  │ SELECT ...
  ↓
Express
  │
  ↓
React
23. Authentication

Your protected API structure is important.

For example:

app.get(
  "/api/enquiries",
  auth,
  async (...)
)

This means:

Request
   ↓
auth middleware
   ↓
JWT valid?
   ├── NO → 401
   │
   └── YES
        ↓
     Database

That's why your earlier browser error was:

POST /api/auth/login
401 Unauthorized

A 401 from the login route means the credentials were not accepted—not that React itself failed.

24. Your Current Deployment Problem

From the backend file I inspected, I found a very important issue.

Your file has:

startServer();

near the first startup section and then another:

startServer();

near the bottom.

The file therefore starts the server twice. The first startup succeeds, then the second attempts to listen on the same port and produces:

EADDRINUSE
0.0.0.0:10000

The source contains one startup call around lines 1164 and another around line 1210.

There is also another duplicate startup block later in the same source, confirming that this file has duplicated backend sections.

Therefore your Render issue is:
Problem 1
OWNER_USERNAME / OWNER_PASSWORD
        ↓
not reaching Node process

Problem 2
startServer()
        ↓
called multiple times
        ↓
EADDRINUSE
25. Correct Production Architecture

For your current project, I recommend this final architecture:

SCOT IT Academy
│
├── frontend/
│   │
│   ├── React
│   ├── Login
│   ├── Dashboard
│   ├── Enquiries
│   ├── Students
│   ├── Follow-ups
│   ├── Reports
│   ├── Admins
│   ├── Categories
│   ├── Refer By
│   └── Settings
│
└── backend/
    │
    ├── Express
    ├── JWT
    ├── bcrypt
    ├── MySQL
    │
    └── APIs
        ├── auth
        ├── dashboard
        ├── students
        ├── enquiries
        ├── follow-ups
        ├── reports
        ├── admins
        ├── categories
        ├── notifications
        └── settings
26. Frontend → Backend connection

Your production React frontend should use:

https://scot-it-academy-1.onrender.com

Then:

Login
/api/auth/login

Dashboard
/api/dashboard

Enquiries
/api/enquiries

Follow-ups
/api/follow-ups

Reports
/api/reports

Categories
/api/categories

Settings
/api/settings

Notifications
/api/notifications

The frontend should attach the JWT to protected requests:

Authorization: Bearer <JWT>
27. Final picture of your entire application
                    SCOT IT ACADEMY
                           │
                           ▼
                    ┌─────────────┐
                    │    LOGIN    │
                    └──────┬──────┘
                           │
                         JWT
                           │
                           ▼
                    ┌─────────────┐
                    │  DASHBOARD  │
                    └──────┬──────┘
                           │
       ┌───────────────────┼────────────────────┐
       │                   │                    │
       ▼                   ▼                    ▼
  ADD ENQUIRY        ENQUIRY LIST          FOLLOW-UPS
       │                   │                    │
       └───────────────────┼────────────────────┘
                           ▼
                     ENQUIRY STATUS
                           │
             ┌─────────────┼──────────────┐
             │             │              │
             ▼             ▼              ▼
          Pending       Positive       Negative
                           │
                           ▼
                         JOINED
                           │
                           ▼
                       STUDENTS
                           │
                           ▼
                    FEES / BALANCE
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
          REPORTS                 NOTIFICATIONS
              │
              ▼
          MANAGEMENT
In simple words

This entire site is an academy CRM.

It takes a person from:

Enquiry → Follow-up → Positive → Joined → Student → Fee Tracking → Reports.

And the Owner/Admin system controls who can access and manage that information.