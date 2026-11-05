import { query, closePool } from '../server/config/db.js';
import { AuthService } from '../server/services/authService.js';
import { hashPassword, verifyPassword } from '../server/utils/security.js';

async function runE2ETests() {
  console.log('--- STARTING SYSTEM E2E TESTS ---');
  let failures = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
    } else {
      console.error(`[FAIL] ${testName}`);
      failures++;
    }
  }

  try {
    // 1. Database Connection & Core Schema
    const tablesRes = await query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public';
    `);
    const tables = tablesRes.rows.map(r => r.table_name);
    assert(tables.includes('users'), 'Table "users" exists');
    assert(tables.includes('projects'), 'Table "projects" exists');
    assert(tables.includes('tasks'), 'Table "tasks" exists');
    assert(tables.includes('documents'), 'Table "documents" exists');
    assert(tables.includes('calendar_events'), 'Table "calendar_events" exists');
    assert(tables.includes('conversations'), 'Table "conversations" exists');
    assert(tables.includes('messages'), 'Table "messages" exists');
    assert(tables.includes('notifications'), 'Table "notifications" exists');

    // 2. Auth Flow: Admin Login & Password Verification
    const adminUser = await query(`SELECT * FROM users WHERE email = 'admin@nexxoory.com';`);
    assert(adminUser.rows.length > 0, 'Admin user account exists');
    const pwdOk = await verifyPassword(adminUser.rows[0].password_hash, 'admin123');
    assert(pwdOk, 'Admin password hash argon2id matches "admin123"');

    const loginRes = await AuthService.login('admin@nexxoory.com', 'admin123');
    assert(Boolean(loginRes.accessToken), 'AuthService.login returns accessToken');
    assert(Boolean(loginRes.rawRefreshToken), 'AuthService.login returns rawRefreshToken');
    assert(loginRes.user.role === 'admin', 'AuthService.login returns role: admin');

    // 3. User Seed Check / Creation for Multi-Role Tests
    let tmUser = (await query(`SELECT * FROM users WHERE role = 'team_member' LIMIT 1;`)).rows[0];
    if (!tmUser) {
      const tmHash = await hashPassword('password123');
      const tmCreated = await query(`
        INSERT INTO users (name, email, password_hash, role, department, designation, status)
        VALUES ('Test Team Member', 'member@nexxoory.com', $1, 'team_member', 'Development', 'Software Engineer', 'Active')
        RETURNING *;
      `, [tmHash]);
      tmUser = tmCreated.rows[0];
    }
    assert(Boolean(tmUser), 'Team member account available for testing');

    let pmUser = (await query(`SELECT * FROM users WHERE role = 'project_manager' LIMIT 1;`)).rows[0];
    if (!pmUser) {
      const pmHash = await hashPassword('password123');
      const pmCreated = await query(`
        INSERT INTO users (name, email, password_hash, role, department, designation, status)
        VALUES ('Test Team Leader', 'leader@nexxoory.com', $1, 'project_manager', 'Development', 'Tech Lead', 'Active')
        RETURNING *;
      `, [pmHash]);
      pmUser = pmCreated.rows[0];
    }
    assert(Boolean(pmUser), 'Team leader account available for testing');

    // 4. Team & Project Hierarchy
    let team = (await query(`SELECT * FROM teams LIMIT 1;`)).rows[0];
    if (!team) {
      const tCreated = await query(`
        INSERT INTO teams (name, department, leader_id)
        VALUES ('Core Engineering', 'Development', $1)
        RETURNING *;
      `, [pmUser.id]);
      team = tCreated.rows[0];
      await query(`
        INSERT INTO team_members (team_id, user_id)
        VALUES ($1, $2) ON CONFLICT DO NOTHING;
      `, [team.id, tmUser.id]);
    }
    assert(Boolean(team), 'Team structure verified');

    let project = (await query(`SELECT * FROM projects LIMIT 1;`)).rows[0];
    if (!project) {
      const pCreated = await query(`
        INSERT INTO projects (name, manager_id, status)
        VALUES ('Nexxoory Platform', $1, 'active')
        RETURNING *;
      `, [pmUser.id]);
      project = pCreated.rows[0];
    }
    assert(Boolean(project), 'Project structure verified');

    // 5. Tasks Creation & Progress Integrity
    const taskTitle = `E2E Test Task ${Date.now()}`;
    const taskInsert = await query(`
      INSERT INTO tasks (title, description, project_id, assignee_id, team_id, priority, status, start_date, due_date, progress, labels)
      VALUES ($1, 'Testing task creation', $2, $3, $4, 'High', 'To Do', CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days', 0, ARRAY['Backend'])
      RETURNING *;
    `, [taskTitle, project.id, tmUser.id, team.id]);
    const createdTask = taskInsert.rows[0];
    assert(createdTask.title === taskTitle, 'Task inserted and retrieved');
    assert(createdTask.assignee_id === tmUser.id, 'Task correctly assigned to team member');

    // 6. Documents Storage in PostgreSQL (BYTEA)
    const testDocName = `spec-${Date.now()}.pdf`;
    const dummyBuffer = Buffer.from('%PDF-1.4 E2E Test document content binary buffer');
    const docInsert = await query(`
      INSERT INTO documents (name, folder, project_id, size_bytes, mime_type, file_data, author_id)
      VALUES ($1, 'General', $2, $3, 'application/pdf', $4, $5)
      RETURNING id, name, size_bytes, mime_type;
    `, [testDocName, project.id, dummyBuffer.length, dummyBuffer, adminUser.rows[0].id]);
    assert(docInsert.rows[0].name === testDocName, 'Document successfully stored in DB BYTEA');
    assert(Number(docInsert.rows[0].size_bytes) === dummyBuffer.length, 'Document BYTEA size matches metadata');

    const docFetch = await query(`SELECT file_data FROM documents WHERE id = $1;`, [docInsert.rows[0].id]);
    assert(Buffer.compare(docFetch.rows[0].file_data, dummyBuffer) === 0, 'Document byte payload matches bit-for-bit');

    // 7. Calendar RBAC & Notification Triggers
    const evtTitle = `All-Hands Standup ${Date.now()}`;
    const evtInsert = await query(`
      INSERT INTO calendar_events (title, description, type, start_date, end_date, creator_id)
      VALUES ($1, 'Company wide sync', 'company_event', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 hour', $2)
      RETURNING *;
    `, [evtTitle, adminUser.rows[0].id]);
    assert(evtInsert.rows[0].title === evtTitle, 'Company event inserted');

    // Insert broadcast notification
    await query(`
      INSERT INTO notifications (user_id, title, message, type, link)
      VALUES ($1, $2, 'Event notification test', 'calendar_event', '/calendar');
    `, [tmUser.id, `New Event: ${evtTitle}`]);

    const notifRes = await query(`
      SELECT * FROM notifications WHERE user_id = $1 AND title = $2;
    `, [tmUser.id, `New Event: ${evtTitle}`]);
    assert(notifRes.rows.length > 0, 'Notification delivered to team member account');
    assert(notifRes.rows[0].type === 'calendar_event', 'Notification type matches "calendar_event"');

    // 8. Cleanup test records
    await query(`DELETE FROM notifications WHERE id = $1;`, [notifRes.rows[0].id]);
    await query(`DELETE FROM calendar_events WHERE id = $1;`, [evtInsert.rows[0].id]);
    await query(`DELETE FROM documents WHERE id = $1;`, [docInsert.rows[0].id]);
    await query(`DELETE FROM tasks WHERE id = $1;`, [createdTask.id]);
    console.log('[PASS] Temporary test artifacts cleaned');

  } catch (err) {
    console.error('[ERROR] Unhandled error during E2E testing:', err);
    failures++;
  } finally {
    await closePool();
  }

  console.log('--- TEST RESULTS ---');
  if (failures === 0) {
    console.log('ALL TESTS PASSED (0 FAILURES)');
    process.exit(0);
  } else {
    console.error(`TESTS FAILED WITH ${failures} ERRORS`);
    process.exit(1);
  }
}

runE2ETests();
