# Content production workflow

Projects and tasks default to Content view. Existing grid, list and Kanban views remain available.

Projects store client details, contract dates, monthly Post/Reel/AI Reel commitments, a shared brief and internal notes. Internal notes are excluded from team-member API responses, including bootstrap. Counts compare actual published content against monthly targets.

Tasks store content type, design status/date, approval status, feedback, planned publication and actual publication. Existing task status remains independent of publishing status. Records without publication dates remain visible in the month-filtered content schedule.

Admins and project managers manage content within existing record scopes. Team members update design status/date only on tasks assigned directly to them. Approval and publication require manager/admin access. Deletion remains admin-only. Approval is required before scheduling or publishing; scheduling requires a planned publication date. Material topic, description, designer or design changes invalidate approval and scheduling. Approval/publication actor IDs and timestamps are recorded; workflow changes are appended to content_workflow_history within the same transaction.

Migration 005 adds JSONB metadata columns and an audit history table without altering existing record fields. Apply with `npm run migrate` before deploying the application against another database.

Run `npm run check` for lint, production build, API security tests and workflow validation/permission tests. Run `npm run test:api:readonly` to check real database reads for all three roles.

Spreadsheet import, external client approval and automated social publishing are not included.
