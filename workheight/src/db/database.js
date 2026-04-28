const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'workheight.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK(type IN ('specialist', 'employer', 'admin')),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        phone TEXT,
        city TEXT,
        profession TEXT CHECK(profession IN ('Пескоструйщик', 'Маляр', 'Промышленный альпинист', NULL)),
        organization_name TEXT,
        organization_type TEXT CHECK(organization_type IN ('ООО', 'ИП', 'АО', 'ЗАО', 'ПАО', NULL)),
        inn TEXT,
        organization_description TEXT,
        employer_city TEXT,
        employer_email TEXT,
        is_blacklisted INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Resumes table
    CREATE TABLE IF NOT EXISTS resumes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        profession TEXT NOT NULL,
        experience_years INTEGER,
        salary_expectation INTEGER,
        skills TEXT,
        about TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Vacancies table
    CREATE TABLE IF NOT EXISTS vacancies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        profession TEXT NOT NULL,
        city TEXT NOT NULL,
        salary_from INTEGER,
        salary_to INTEGER,
        employment_type TEXT,
        description TEXT,
        requirements TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Responses table
    CREATE TABLE IF NOT EXISTS responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vacancy_id INTEGER NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(vacancy_id, user_id)
    );

    -- Chats table
    CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vacancy_id INTEGER REFERENCES vacancies(id) ON DELETE SET NULL,
        specialist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        employer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(vacancy_id, specialist_id, employer_id)
    );

    -- Messages table
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Blacklist table (moderated)
    CREATE TABLE IF NOT EXISTS blacklist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT,
        is_active INTEGER DEFAULT 1,
        created_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_vacancies_status ON vacancies(status);
    CREATE INDEX IF NOT EXISTS idx_vacancies_profession ON vacancies(profession);
    CREATE INDEX IF NOT EXISTS idx_vacancies_city ON vacancies(city);
    CREATE INDEX IF NOT EXISTS idx_resumes_profession ON resumes(profession);
    CREATE INDEX IF NOT EXISTS idx_responses_status ON responses(status);
    CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
`);

// Create default admin user if not exists
const adminExists = db.prepare('SELECT id FROM users WHERE type = ?').get('admin');
if (!adminExists) {
    const bcrypt = require('bcryptjs');
    const adminPassword = bcrypt.hashSync('admin123', 10);
    db.prepare(`
        INSERT INTO users (type, email, password_hash, full_name)
        VALUES (?, ?, ?, ?)
    `).run('admin', 'admin@workheight.ru', adminPassword, 'Администратор');
    console.log('Default admin created: admin@workheight.ru / admin123');
}

module.exports = db;
