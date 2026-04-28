const express = require('express');
const db = require('../db/database');
const router = express.Router();

// GET /admin - Admin dashboard
router.get('/admin', (req, res) => {
    if (!req.session.user || req.session.user.type !== 'admin') {
        return res.redirect('/login');
    }
    
    // Get stats
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const totalVacancies = db.prepare('SELECT COUNT(*) as count FROM vacancies').get().count;
    const pendingVacancies = db.prepare("SELECT COUNT(*) as count FROM vacancies WHERE status = 'pending'").get().count;
    const totalResumes = db.prepare('SELECT COUNT(*) as count FROM resumes').get().count;
    
    res.render('admin/dashboard', {
        title: 'Админ-панель',
        stats: { totalUsers, totalVacancies, pendingVacancies, totalResumes }
    });
});

// GET /admin/vacancies - Moderate vacancies
router.get('/admin/vacancies', (req, res) => {
    if (!req.session.user || req.session.user.type !== 'admin') {
        return res.redirect('/login');
    }
    
    const vacancies = db.prepare(`
        SELECT v.*, u.organization_name, u.email as employer_email
        FROM vacancies v
        JOIN users u ON v.user_id = u.id
        ORDER BY v.created_at DESC
    `).all();
    
    res.render('admin/vacancies', {
        title: 'Модерация вакансий',
        vacancies
    });
});

// POST /admin/vacancy/:id/status - Update vacancy status
router.post('/admin/vacancy/:id/status', (req, res) => {
    if (!req.session.user || req.session.user.type !== 'admin') {
        return res.redirect('/login');
    }
    
    const { status } = req.body;
    const vacancyId = req.params.id;
    
    if (!['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).send('Неверный статус');
    }
    
    db.prepare('UPDATE vacancies SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, vacancyId);
    res.redirect('/admin/vacancies');
});

// GET /admin/blacklist - Blacklist management
router.get('/admin/blacklist', (req, res) => {
    if (!req.session.user || req.session.user.type !== 'admin') {
        return res.redirect('/login');
    }
    
    const blacklist = db.prepare(`
        SELECT b.*, u.organization_name, u.email, u.inn
        FROM blacklist b
        JOIN users u ON b.employer_id = u.id
        ORDER BY b.created_at DESC
    `).all();
    
    const employers = db.prepare(`
        SELECT id, organization_name, email, inn 
        FROM users 
        WHERE type = 'employer' AND is_blacklisted = 0
        ORDER BY organization_name
    `).all();
    
    res.render('admin/blacklist', {
        title: 'Черный список',
        blacklist,
        employers
    });
});

// POST /admin/blacklist/add - Add to blacklist
router.post('/admin/blacklist/add', (req, res) => {
    if (!req.session.user || req.session.user.type !== 'admin') {
        return res.redirect('/login');
    }
    
    const { employer_id, reason } = req.body;
    
    if (!employer_id) {
        return res.status(400).send('Требуется employer_id');
    }
    
    db.prepare(`
        INSERT INTO blacklist (employer_id, reason, created_by)
        VALUES (?, ?, ?)
    `).run(employer_id, reason || null, req.session.user.id);
    
    db.prepare('UPDATE users SET is_blacklisted = 1 WHERE id = ?').run(employer_id);
    
    res.redirect('/admin/blacklist');
});

// POST /admin/blacklist/remove - Remove from blacklist
router.post('/admin/blacklist/remove', (req, res) => {
    if (!req.session.user || req.session.user.type !== 'admin') {
        return res.redirect('/login');
    }
    
    const { id } = req.body;
    
    const entry = db.prepare('SELECT employer_id FROM blacklist WHERE id = ?').get(id);
    if (entry) {
        db.prepare('UPDATE blacklist SET is_active = 0 WHERE id = ?').run(id);
        db.prepare('UPDATE users SET is_blacklisted = 0 WHERE id = ?').run(entry.employer_id);
    }
    
    res.redirect('/admin/blacklist');
});

module.exports = router;
