const express = require('express');
const db = require('../db/database');
const router = express.Router();

const PROFESSIONS = ['Пескоструйщик', 'Маляр', 'Промышленный альпинист'];

// GET /vacancies - List vacancies with filters
router.get('/vacancies', (req, res) => {
    const { search, profession, city, employment_type } = req.query;
    
    let query = `
        SELECT v.*, u.organization_name, u.organization_type, u.employer_email, u.employer_phone, u.employer_city
        FROM vacancies v
        JOIN users u ON v.user_id = u.id
        WHERE v.status = 'approved'
    `;
    
    const params = [];
    
    if (search) {
        query += ` AND (v.title LIKE ? OR v.description LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }
    
    if (profession) {
        query += ` AND v.profession = ?`;
        params.push(profession);
    }
    
    if (city) {
        query += ` AND v.city = ?`;
        params.push(city);
    }
    
    if (employment_type) {
        query += ` AND v.employment_type = ?`;
        params.push(employment_type);
    }
    
    query += ` ORDER BY v.created_at DESC LIMIT 50`;
    
    const vacancies = db.prepare(query).all(...params);
    
    // Get unique cities for filter
    const cities = db.prepare(`SELECT DISTINCT city FROM vacancies WHERE status = 'approved' ORDER BY city`).all();
    
    res.render('vacancies/list', {
        title: 'Вакансии',
        vacancies,
        professions: PROFESSIONS,
        cities: cities.map(c => c.city),
        filters: { search, profession, city, employment_type },
        activePage: 'vacancies'
    });
});

// GET /vacancies/create - Create vacancy form (employers only)
router.get('/vacancies/create', (req, res) => {
    if (!req.session.user || req.session.user.type !== 'employer') {
        return res.redirect('/login');
    }
    res.render('vacancies/create', {
        title: 'Создать вакансию',
        professions: PROFESSIONS,
        error: null
    });
});

// POST /vacancies/create - Handle vacancy creation
router.post('/vacancies/create', (req, res) => {
    if (!req.session.user || req.session.user.type !== 'employer') {
        return res.redirect('/login');
    }
    
    try {
        const { title, profession, city, salary_from, salary_to, employment_type, description, requirements } = req.body;
        
        if (!title || !profession || !city) {
            return res.render('vacancies/create', {
                title: 'Создать вакансию',
                professions: PROFESSIONS,
                error: 'Заполните обязательные поля'
            });
        }
        
        const result = db.prepare(`
            INSERT INTO vacancies (user_id, title, profession, city, salary_from, salary_to, employment_type, description, requirements)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            req.session.user.id,
            title,
            profession,
            city,
            salary_from || null,
            salary_to || null,
            employment_type || null,
            description || null,
            requirements || null
        );
        
        res.redirect('/cabinet/employer');
    } catch (err) {
        console.error('Create vacancy error:', err);
        res.render('vacancies/create', {
            title: 'Создать вакансию',
            professions: PROFESSIONS,
            error: 'Ошибка создания вакансии'
        });
    }
});

// GET /vacancies/:id - Show vacancy details
router.get('/vacancies/:id', (req, res) => {
    const vacancy = db.prepare(`
        SELECT v.*, u.organization_name, u.organization_type, u.employer_email, u.employer_phone, u.employer_city
        FROM vacancies v
        JOIN users u ON v.user_id = u.id
        WHERE v.id = ?
    `).get(req.params.id);
    
    if (!vacancy) {
        return res.status(404).send('Вакансия не найдена');
    }
    
    let hasResponded = false;
    if (req.session.user && req.session.user.type === 'specialist') {
        const response = db.prepare('SELECT id FROM responses WHERE vacancy_id = ? AND user_id = ?').get(req.params.id, req.session.user.id);
        hasResponded = !!response;
    }
    
    res.render('vacancies/show', {
        title: vacancy.title,
        vacancy,
        hasResponded,
        user: req.session.user || null
    });
});

// GET /vacancies/:id/respond - Respond to vacancy form
router.get('/vacancies/:id/respond', (req, res) => {
    if (!req.session.user || req.session.user.type !== 'specialist') {
        return res.redirect('/login');
    }
    
    const vacancy = db.prepare('SELECT * FROM vacancies WHERE id = ?').get(req.params.id);
    if (!vacancy) {
        return res.status(404).send('Вакансия не найдена');
    }
    
    res.render('vacancies/respond', {
        title: 'Откликнуться',
        vacancy,
        error: null
    });
});

// POST /vacancies/:id/respond - Handle response
router.post('/vacancies/:id/respond', (req, res) => {
    if (!req.session.user || req.session.user.type !== 'specialist') {
        return res.redirect('/login');
    }
    
    try {
        const { message } = req.body;
        const vacancyId = req.params.id;
        
        // Check if already responded
        const existing = db.prepare('SELECT id FROM responses WHERE vacancy_id = ? AND user_id = ?').get(vacancyId, req.session.user.id);
        if (existing) {
            return res.redirect(`/vacancies/${vacancyId}`);
        }
        
        // Create response
        db.prepare(`
            INSERT INTO responses (vacancy_id, user_id, message)
            VALUES (?, ?, ?)
        `).run(vacancyId, req.session.user.id, message || null);
        
        // Create or get chat
        const vacancy = db.prepare('SELECT * FROM vacancies WHERE id = ?', { id: vacancyId }).get(vacancyId);
        const employerId = vacancy.user_id;
        
        let chat = db.prepare(`
            SELECT id FROM chats 
            WHERE vacancy_id = ? AND specialist_id = ? AND employer_id = ?
        `).get(vacancyId, req.session.user.id, employerId);
        
        if (!chat) {
            const result = db.prepare(`
                INSERT INTO chats (vacancy_id, specialist_id, employer_id)
                VALUES (?, ?, ?)
            `).run(vacancyId, req.session.user.id, employerId);
            chat = { id: result.lastInsertRowid };
        }
        
        res.redirect(`/vacancies/${vacancyId}`);
    } catch (err) {
        console.error('Response error:', err);
        res.render('vacancies/respond', {
            title: 'Откликнуться',
            vacancy: db.prepare('SELECT * FROM vacancies WHERE id = ?').get(req.params.id),
            error: 'Ошибка отправки отклика'
        });
    }
});

// GET /vacancy/:id/responses - View responses (employer only)
router.get('/vacancy/:id/responses', (req, res) => {
    if (!req.session.user || req.session.user.type !== 'employer') {
        return res.redirect('/login');
    }
    
    const vacancy = db.prepare('SELECT * FROM vacancies WHERE id = ? AND user_id = ?').get(req.params.id, req.session.user.id);
    if (!vacancy) {
        return res.status(404).send('Вакансия не найдена или недоступна');
    }
    
    const responses = db.prepare(`
        SELECT r.*, u.full_name, u.profession, u.city, u.phone
        FROM responses r
        JOIN users u ON r.user_id = u.id
        WHERE r.vacancy_id = ?
        ORDER BY r.created_at DESC
    `).all(req.params.id);
    
    res.render('vacancies/responses', {
        title: 'Отклики',
        vacancy,
        responses
    });
});

module.exports = router;
