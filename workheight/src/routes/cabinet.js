const express = require('express');
const db = require('../db/database');
const router = express.Router();

// GET /cabinet/specialist - Specialist cabinet
router.get('/cabinet/specialist', (req, res) => {
    if (!req.session.user || req.session.user.type !== 'specialist') {
        return res.redirect('/login');
    }
    
    const userId = req.session.user.id;
    
    // Get user's resume
    const resume = db.prepare('SELECT * FROM resumes WHERE user_id = ?').get(userId);
    
    // Get user's responses
    const responses = db.prepare(`
        SELECT r.*, v.title as vacancy_title, v.city, u.organization_name, r.status
        FROM responses r
        JOIN vacancies v ON r.vacancy_id = v.id
        JOIN users u ON v.user_id = u.id
        WHERE r.user_id = ?
        ORDER BY r.created_at DESC
    `).all(userId);
    
    // Get user's chats
    const chats = db.prepare(`
        SELECT c.id, 
               CASE WHEN c.specialist_id = ? THEN u.full_name ELSE u.organization_name END as other_name,
               (SELECT text FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
        FROM chats c
        JOIN users u ON (CASE WHEN c.specialist_id = ? THEN u.id = c.employer_id ELSE u.id = c.specialist_id END)
        WHERE c.specialist_id = ? OR c.employer_id = ?
        ORDER BY c.created_at DESC
    `).all(userId, userId, userId, userId);
    
    // Count unread messages
    const unreadCount = db.prepare(`
        SELECT COUNT(*) as count FROM messages m
        JOIN chats c ON m.chat_id = c.id
        WHERE m.is_read = 0 AND m.sender_id != ? AND (c.specialist_id = ? OR c.employer_id = ?)
    `).get(userId, userId, userId).count;
    
    res.render('cabinet/specialist', {
        title: 'Личный кабинет',
        user: req.session.user,
        resume,
        responses,
        chats,
        unreadCount
    });
});

// GET /cabinet/employer - Employer cabinet
router.get('/cabinet/employer', (req, res) => {
    if (!req.session.user || req.session.user.type !== 'employer') {
        return res.redirect('/login');
    }
    
    const userId = req.session.user.id;
    
    // Get employer's vacancies
    const vacancies = db.prepare(`
        SELECT * FROM vacancies WHERE user_id = ? ORDER BY created_at DESC
    `).all(userId);
    
    // Get response counts for each vacancy
    const vacanciesWithCounts = vacancies.map(v => {
        const count = db.prepare('SELECT COUNT(*) as count FROM responses WHERE vacancy_id = ?', { id: v.id }).get(v.id).count;
        return { ...v, responseCount: count };
    });
    
    // Get employer's chats
    const chats = db.prepare(`
        SELECT c.id, u.full_name as other_name,
               (SELECT text FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
        FROM chats c
        JOIN users u ON u.id = c.specialist_id
        WHERE c.employer_id = ?
        ORDER BY c.created_at DESC
    `).all(userId);
    
    // Count unread messages
    const unreadCount = db.prepare(`
        SELECT COUNT(*) as count FROM messages m
        JOIN chats c ON m.chat_id = c.id
        WHERE m.is_read = 0 AND m.sender_id != ? AND c.employer_id = ?
    `).get(userId, userId).count;
    
    res.render('cabinet/employer', {
        title: 'Личный кабинет работодателя',
        user: req.session.user,
        vacancies: vacanciesWithCounts,
        chats,
        unreadCount
    });
});

module.exports = router;
