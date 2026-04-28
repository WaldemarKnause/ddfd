const express = require('express');
const db = require('../db/database');
const router = express.Router();

const PROFESSIONS = ['Пескоструйщик', 'Маляр', 'Промышленный альпинист'];

// GET / - Home page
router.get('/', (req, res) => {
    // Get latest approved vacancies
    const vacancies = db.prepare(`
        SELECT v.*, u.organization_name
        FROM vacancies v
        JOIN users u ON v.user_id = u.id
        WHERE v.status = 'approved'
        ORDER BY v.created_at DESC
        LIMIT 6
    `).all();
    
    res.render('index', {
        title: 'Главная',
        vacancies,
        professions: PROFESSIONS,
        activePage: 'home'
    });
});

module.exports = router;
