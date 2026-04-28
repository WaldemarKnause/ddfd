const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const router = express.Router();

// GET /register - Registration page
router.get('/register', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('auth/register', { 
        title: 'Регистрация',
        error: null 
    });
});

// POST /register - Handle registration
router.post('/register', async (req, res) => {
    try {
        const { type, email, password, full_name, phone, city, profession, 
                organization_name, organization_type, inn, organization_description, employer_city } = req.body;

        // Validate type
        if (!['specialist', 'employer'].includes(type)) {
            return res.render('auth/register', { title: 'Регистрация', error: 'Неверный тип пользователя' });
        }

        // Check if email exists
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existingUser) {
            return res.render('auth/register', { title: 'Регистрация', error: 'Email уже зарегистрирован' });
        }

        // Validate password
        if (!password || password.length < 6) {
            return res.render('auth/register', { title: 'Регистрация', error: 'Пароль должен быть не менее 6 символов' });
        }

        // Hash password
        const passwordHash = bcrypt.hashSync(password, 10);

        // Insert user
        let result;
        if (type === 'specialist') {
            result = db.prepare(`
                INSERT INTO users (type, email, password_hash, full_name, phone, city, profession)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(type, email, passwordHash, full_name, phone, city, profession);
        } else {
            // Employer
            if (!organization_name || !organization_type) {
                return res.render('auth/register', { title: 'Регистрация', error: 'Название и тип организации обязательны' });
            }
            result = db.prepare(`
                INSERT INTO users (type, email, password_hash, organization_name, organization_type, inn, phone, city, organization_description, employer_city, employer_email)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(type, email, passwordHash, organization_name, organization_type, inn, phone, city, organization_description, employer_city, email);
        }

        // Auto login
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
        req.session.user = {
            id: user.id,
            type: user.type,
            email: user.email,
            full_name: user.full_name,
            organization_name: user.organization_name
        };

        res.redirect('/');
    } catch (err) {
        console.error('Registration error:', err);
        res.render('auth/register', { title: 'Регистрация', error: 'Ошибка регистрации. Попробуйте снова.' });
    }
});

// GET /login - Login page
router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('auth/login', { title: 'Вход', error: null });
});

// POST /login - Handle login
router.post('/login', (req, res) => {
    try {
        const { email, password } = req.body;

        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user) {
            return res.render('auth/login', { title: 'Вход', error: 'Неверный email или пароль' });
        }

        // Check if blacklisted
        if (user.is_blacklisted) {
            return res.render('auth/login', { title: 'Вход', error: 'Ваш аккаунт заблокирован администратором' });
        }

        const validPassword = bcrypt.compareSync(password, user.password_hash);
        if (!validPassword) {
            return res.render('auth/login', { title: 'Вход', error: 'Неверный email или пароль' });
        }

        req.session.user = {
            id: user.id,
            type: user.type,
            email: user.email,
            full_name: user.full_name,
            organization_name: user.organization_name
        };

        res.redirect('/');
    } catch (err) {
        console.error('Login error:', err);
        res.render('auth/login', { title: 'Вход', error: 'Ошибка входа. Попробуйте снова.' });
    }
});

// GET /logout - Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

module.exports = router;
