# Login recovery

A 401 from `/api/auth/login` means the API rejected the supplied username/password.
The React DevTools notice and development WebSocket disconnect on browser
back/forward navigation do not cause this authentication response.

## Deploy the repair

The backend entry point is `backend/src/server.js`; run `npm start` with
`backend` as the working directory. This patch restores the MySQL API from
commit `7ff6c7e`, replacing React page code accidentally copied into its file.
It requires the existing MySQL connection (`DATABASE_URL` or `DB_*`) and
`JWT_SECRET`. Keep the existing JWT secret unless intentionally revoking sessions.

The frontend uses `REACT_APP_API_URL`, including `/api`, and
`REACT_APP_USE_BACKEND=true`. Rebuild/redeploy the frontend after changing these
build-time variables. The repository's frontend `.env` targets the Render API.

## Recover the owner account

Only an operator with access to the backend environment/database can do this.
Do not put a database URL or owner password in frontend variables or Git.

1. Set backend `OWNER_USERNAME` to the desired username, `OWNER_PASSWORD` to a
   new private password of at least 8 characters, and optionally `OWNER_NAME`.
2. After deploying the repaired backend, run in the Render backend shell:

   ```sh
   # From the backend directory
   npm run owner:reset
   ```

3. Log in using exactly those values. Password spaces are significant.

The command updates the first existing Owner by ID, or creates one if none exists.
It rejects a username belonging to another account, stores a bcrypt hash, and does
not delete enquiries, students, or other academy data. The users table must already
exist (normal API startup initializes it). If the service has multiple Owner
accounts, verify which account is being recovered before running this command.
Existing JWTs remain valid until their seven-day expiry; rotate JWT_SECRET and
restart the service if recovery also needs to sign out every existing session.

On ordinary startup, an existing owner's saved username/password is preserved.
`OWNER_*` only creates the initial owner when none exists. Changing these variables
alone does not reset an existing account: use the explicit command above.
There are no default production passwords or public owner-reset endpoints.

## Verification

`cd backend && npm test` tests bootstrap and recovery behavior without a provider.
Verify production login after deployment; repository tests cannot identify or
validate the current production owner's password.
