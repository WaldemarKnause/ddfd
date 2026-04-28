const express = require('express');
const db = require('../db/database');
const router = express.Router();

const PROFESSIONS = ['Пескоструйщик', 'Маляр', 'Промышленный альпинист'];

// GET /resumes - List resumes with filters
router.get('/resumes', (req, res) => {
    const { search, profession, city } = req.query;
    
    let query = `
        SELECT r.*, u.full_name, u.city, u.phone
        FROM resumes r
        JOIN users u ON r.user_id = u.id
        WHERE 1=1
    `;
    
    const params = [];
    
    if (search) {
        query += ` AND (r.skills LIKE ? OR r.about LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }
    
    if (profession) {
        query += ` AND r.profession = ?`;
        params.push(profession);
    }
    
    if (city) {
        query += ` AND u.city = ?`;
        params.push(city);
    }
    
    query += ` ORDER BY r.created_at DESC LIMIT 50`;
    
    const resumes = db.prepare(query).all(...params);
    
    res.render('resumes/list', {
        title: 'Резюме',
        resumes,
        professions: PROFESSIONS,
        cities: [],
        filters: { search, profession, city },
        activePage: 'resumes'
    });
});

// GET /resumes/create - Create/edit resume form
router.get('/resumes/create', (req, res) => {
    if (!req.session.user || req.session.user.type !== 'specialist') {
        return res.redirect('/login');
    }
    
    const resume = db.prepare('SELECT * FROM resumes WHERE user_id = ?').get(req.session.user.id);
    
    res.render('resumes/create', {
        title: resume ? 'Редактировать резюме' : 'Создать резюме',
        professions: PROFESSIONS,
        resume: resume || null,
        error: null
    });
});

// POST /resumes/create - Handle resume creation/update
router.post('/resumes/create', (req, res) => {
    if (!req.session.user || req.session.user.type !== 'specialist') {
        return res.redirect('/login');
    }
    
    try {
        const { profession, experience_years, salary_expectation, skills, about } = req.body;
        
        if (!profession) {
            return res.render('resumes/create', {
                title: 'Создать резюме',
                professions: PROFESSIONS,
                resume: null,
                error: 'Выберите специальность'
            });
        }
        
        const existingResume = db.prepare('SELECT id FROM resumes WHERE user_id = ?').get(req.session.user.id);
        
        if (existingResume) {
            // Update
            db.prepare(`
                UPDATE resumes 
                SET profession = ?, experience_years = ?, salary_expectation = ?, skills = ?, about = ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            `).run(profession, experience_years || null, salary_expectation || null, skills || null, about || null, req.session.user.id);
        } else {
            // Insert
            db.prepare(`
                INSERT INTO resumes (user_id, profession, experience_years, salary_expectation, skills, about)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(req.session.user.id, profession, experience_years || null, salary_expectation || null, skills || null, about || null);
        }
        
        res.redirect('/cabinet/specialist');
    } catch (err) {
        console.error('Resume error:', err);
        res.render('resumes/create', {
            title: 'Создать резюме',
            professions: PROFESSIONS,
            resume: db.prepare('SELECT * FROM resumes WHERE user_id = ?').get(req.session.user.id),
            error: 'Ошибка сохранения резюме'
        });
    }
});

// GET /resumes/:id - Show resume details
router.get('/resumes/:id', (req, res) => {
    const resume = db.prepare(`
        SELECT r.*, u.full_name, u.city, u.phone, u.email
        FROM resumes r
        JOIN users u ON r.user_id = u.id
        WHERE r.id = ?
    `).get(req.params.id);
    
    if (!resume) {
        return res.status(404).send('Резюме не найдено');
    }
    
    res.render('resumes/show', {
        title: `${resume.profession} - ${resume.full_name}`,
        resume
    });
});

module.exports = router;
