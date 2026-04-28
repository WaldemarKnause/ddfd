const express = require('express');
const db = require('../db/database');
const router = express.Router();

// GET /chat/:id - Chat page
router.get('/chat/:id', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    
    const chatId = req.params.id;
    const userId = req.session.user.id;
    
    // Get chat and verify user has access
    const chat = db.prepare(`
        SELECT c.*, v.title as vacancy_title
        FROM chats c
        LEFT JOIN vacancies v ON c.vacancy_id = v.id
        WHERE c.id = ? AND (c.specialist_id = ? OR c.employer_id = ?)
    `).get(chatId, userId, userId);
    
    if (!chat) {
        return res.status(404).send('Чат не найден');
    }
    
    // Get other user info
    const isSpecialist = chat.specialist_id === userId;
    const otherUserId = isSpecialist ? chat.employer_id : chat.specialist_id;
    const otherUser = db.prepare('SELECT id, full_name, organization_name, type FROM users WHERE id = ?').get(otherUserId);
    
    // Get all chats for sidebar
    const allChats = db.prepare(`
        SELECT c.id,
               CASE 
                   WHEN c.specialist_id = ? THEN (SELECT organization_name FROM users WHERE id = c.employer_id)
                   ELSE (SELECT full_name FROM users WHERE id = c.specialist_id)
               END as other_name,
               (SELECT text FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
        FROM chats c
        WHERE c.specialist_id = ? OR c.employer_id = ?
        ORDER BY c.created_at DESC
    `).all(userId, userId, userId);
    
    // Get messages
    const messages = db.prepare(`
        SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC
    `).all(chatId);
    
    // Mark messages as read
    db.prepare(`
        UPDATE messages SET is_read = 1 WHERE chat_id = ? AND sender_id != ? AND is_read = 0
    `).run(chatId, userId);
    
    res.render('chat/index', {
        title: 'Чат',
        chat,
        otherUser,
        messages,
        allChats
    });
});

// POST /chat/:id/send - Send message
router.post('/chat/:id/send', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    
    const { text } = req.body;
    const chatId = req.params.id;
    const userId = req.session.user.id;
    
    if (!text || !text.trim()) {
        return res.redirect(`/chat/${chatId}`);
    }
    
    // Verify user has access to chat
    const chat = db.prepare('SELECT id FROM chats WHERE id = ? AND (specialist_id = ? OR employer_id = ?)').get(chatId, userId, userId);
    if (!chat) {
        return res.status(404).send('Чат не найден');
    }
    
    // Insert message
    db.prepare(`
        INSERT INTO messages (chat_id, sender_id, text)
        VALUES (?, ?, ?)
    `).run(chatId, userId, text.trim());
    
    res.redirect(`/chat/${chatId}`);
});

module.exports = router;
