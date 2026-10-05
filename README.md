# SCOT IT Academy

SCOT IT Academy is an enquiry and student management application for academy staff. It supports the workflow from capturing an enquiry and scheduling follow-ups through student enrollment and fee tracking.

## Features

- JWT-authenticated owner and admin access
- Enquiry creation, search, editing, status tracking, referral sources, and follow-up scheduling
- Student records with generated SCOT IDs, course and contact details, referral source, comments, and fee balances
- Dashboard metrics, monthly/yearly reports, lead-source breakdowns, and CSV, Excel, and PDF exports
- Category, referral-source, admin, and academy settings management
- Due-fee notifications

The Reports page provides year/month filters. Its Status Summary is scoped to the current calendar month and resets when a new month begins.

## Architecture

- `frontend/`: React 19 application built with Create React App and `react-scripts`
- `backend/`: Express API, MySQL persistence, JWT authentication, and database schema initialization
- `docs/`: supporting documentation, including [login recovery](docs/login-recovery.md)

The frontend communicates with the backend through Axios. MySQL is the authoritative database when backend mode is enabled. Without `REACT_APP_USE_BACKEND=true`, the frontend uses local dummy data stored in the browser.

## Application Walkthrough

The application supports the day-to-day academy workflow:

1. Staff signs in. The frontend stores the returned JWT and attaches it to protected API requests.
2. Staff records a candidate in **Add Enquiry**, including contact details, course/category, referral source, enquiry status, and a follow-up date.
3. Staff reviews and updates records in **Enquiry List** and uses **Follow-ups** to work through candidates who need another contact.
4. When a candidate enrolls, staff maintains their record in **Students**, including the SCOT student ID, course, referral source, comments, fees, join date, due date, and status.
5. The dashboard and Reports summarize enquiry/student activity. Student fee balances and due dates also feed overdue-fee notifications.

The frontend and backend keep enquiries and students as separate records. The database schema is initialized by the backend at startup; it does not create the MySQL database itself.

## Application Screens

| Screen | Purpose |
| --- | --- |
| Login, Signup, Forgot Password | Authenticate users, create an account, and recover access. |
| Dashboard | Show high-level enquiry, student, and fee information, with overdue-fee notifications in the application shell. |
| Add Enquiry | Capture candidate, course, referral, status, comment, and follow-up information. |
| Enquiry List | Search, filter, view, and update enquiry records and their follow-up/status information. |
| Follow-ups | Review and work with enquiries that need follow-up. |
| Students | Search and filter student records; add, edit, view, delete, and export student data. Fee balances are calculated from total and paid fees. |
| Reports | Filter by year and month and review enquiry/student totals, statuses, sources, and fee amounts. The Status Summary always counts the current calendar month's enquiries, independent of the selected report period. |
| Categories | Maintain the category values used by enquiry and student forms. |
| Admins | Owner-only staff account management. |
| Settings | Owner-only academy configuration. |

The navigation is protected by login. Admins and Settings routes are additionally restricted to the Owner role. The legacy `/refer-by` path redirects to the Dashboard; referral values are currently selected from shared form options and stored with records.

## Source Code Responsibilities

### Frontend

- `frontend/src/App.js` defines the public, authenticated, and owner-only routes.
- `frontend/src/components/Layout.js` provides the sidebar, page header, logout, and overdue-fee notification UI.
- `frontend/src/pages/` contains the feature screens described above.
- `frontend/src/components/Ui.js` contains shared panels, tables, badges, and pagination controls.
- `frontend/src/data/` contains shared form options and the dummy-data structure.
- `frontend/src/services/api.js` wraps Axios API calls, adds the bearer token, and implements browser-persisted dummy mode.
- `frontend/src/styles.css` contains shared layout, responsive, form, table, and report styles.

### Backend

- `backend/src/server.js` starts the API by loading the MySQL server implementation.
- `backend/src/server-mysql.js` defines Express middleware, authentication, API routes, table initialization/migrations, and request/response mapping.
- `backend/src/database.js` configures the MySQL connection pool from `DATABASE_URL` or `DB_*` variables.
- `backend/src/owner-account.js` creates the initial owner account and enforces password requirements.
- `backend/src/reset-owner.js` resets owner credentials without deleting academy records.
- `backend/src/student-fees.js` validates fee values and calculates the remaining balance; its behavior is covered by backend tests.

## Data Model

The backend creates and maintains these main MySQL tables:

| Table | What it stores |
| --- | --- |
| `users` | Owner and Admin usernames, password hashes, display names, and roles. |
| `enquiries` | Candidate details, course/category/type, status, referral source, comments, and next follow-up date. |
| `students` | Student ID, contact/course information, category/source/comments, enrollment/status dates, and total/paid/balance fees. |
| `categories` | Category names used by forms. |
| `types` | Candidate type values; default types are inserted when the schema initializes. |
| `referrals` | Referral names exposed through the backend referral API. |
| `settings` | Key/value academy settings. |
| `notifications` | Notification records used by the application. Overdue fee notices are also derived from student balances and due dates. |

Passwords are stored as bcrypt hashes. The API uses JWTs to identify authenticated users and checks the user's role for Owner-only operations. Do not put real passwords, tokens, or database credentials in source control.

## Project Layout

```text
SCOT-IT-Academy/
|-- backend/
|   |-- data/
|   |-- src/
|   |   |-- database.js
|   |   |-- owner-account.js
|   |   |-- reset-owner.js
|   |   |-- server-mysql.js
|   |   |-- server.js
|   |   `-- student-fees.js
|   |-- test/
|   `-- .env.example
|-- docs/
|-- frontend/
|   |-- public/
|   `-- src/
|       |-- components/
|       |-- data/
|       |-- pages/
|       `-- services/api.js
`-- README.md
```

## Requirements

- Node.js and npm
- A MySQL-compatible server

## Local Setup

### 1. Create a database

Create an empty database in MySQL, for example:

```sql
CREATE DATABASE scot_it_academy CHARACTER SET utf8mb4;
```

The API initializes and migrates its tables when it starts. The database itself must exist first.

### 2. Configure and start the backend

Copy `backend/.env.example` to `backend/.env`. Configure either a complete `DATABASE_URL` connection string or the individual `DB_*` values. `DATABASE_URL` takes precedence, so remove or leave it empty when using local `DB_*` settings.

Example local configuration:

```env
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=scot_it_academy
DB_USER=root
DB_PASSWORD=your_mysql_password
JWT_SECRET=replace-with-a-long-random-secret
OWNER_USERNAME=owner
OWNER_PASSWORD=replace-with-a-secure-password
OWNER_NAME=SCOT IT Academy Owner
```

Set the owner username and password before the first start. The password must contain at least eight characters. Do not commit `.env` files or real credentials.

```bash
cd backend
npm install
npm start
```

The API uses `PORT` from the environment; its code default is `10000`. With the example above, its health check is `http://localhost:5000/health`.

To explicitly reset the owner credentials later, update the owner variables in `backend/.env` and run:

```bash
cd backend
npm run owner:reset
```

This resets the owner account and preserves academy records. See [docs/login-recovery.md](docs/login-recovery.md) for recovery details.

### 3. Configure and start the frontend

Create `frontend/.env` with the backend URL and enable backend mode:

```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_USE_BACKEND=true
```

Then run:

```bash
cd frontend
npm install
npm start
```

If `REACT_APP_USE_BACKEND` is missing or not `true`, the app uses its local dummy-data mode instead of the MySQL API. Restart the frontend after changing environment variables.

## API Areas

The API is mounted under `/api`. `/health` checks API and database connectivity. The main route groups are:

| Routes | Purpose |
| --- | --- |
| `/api/auth/*` | Login, signup, current-user lookup, and account/password updates. |
| `/api/enquiries` and `/api/enquiries/:id` | List, create, view, update, and delete enquiries. |
| `/api/students` and `/api/students/:id` | List, create, view, update, and delete students. |
| `/api/follow-ups` | Retrieve enquiries for follow-up work. |
| `/api/categories`, `/api/types`, `/api/referrals` | Read and manage form/master values. |
| `/api/admins` | Owner-managed staff accounts. |
| `/api/dashboard`, `/api/reports` | Dashboard metrics and report data. |
| `/api/notifications` | Fee-related notification data. |
| `/api/settings` | Read and update academy settings. |

Protected API requests use a bearer JWT. Owner-only operations include owner account and settings management.

## Tests and Build

Run backend tests:

```bash
cd backend
npm test
```

Run frontend tests:

```bash
cd frontend
npx react-scripts test --watchAll=false --runInBand
```

Create a production frontend build:

```bash
cd frontend
npm run build
```

The backend test suite uses Node's built-in test runner. The frontend uses Jest through `react-scripts`; its package currently provides `start` and `build` scripts, but no `test` script.