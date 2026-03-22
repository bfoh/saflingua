const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ Missing DATABASE_URL environment variable.');
    console.error('   Usage: DATABASE_URL=postgresql://... node run-sql.js');
    process.exit(1);
}

const client = new Client({ connectionString });

async function run() {
    try {
        await client.connect();
        console.log('Connected to PostgreSQL');

        const sql = `
      CREATE TABLE IF NOT EXISTS student_progress (
        student_id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
        xp_points INT DEFAULT 0,
        streak_days INT DEFAULT 0,
        last_active_date DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS lesson_completions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        student_id UUID REFERENCES users(id) ON DELETE CASCADE,
        lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
        completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(student_id, lesson_id)
      );
    `;

        console.log('Executing gamification schema...');
        await client.query(sql);
        console.log('Gamification Database Schema initialized successfully.');
    } catch (error) {
        console.error('Error executing SQL:', error);
    } finally {
        await client.end();
    }
}

run();
