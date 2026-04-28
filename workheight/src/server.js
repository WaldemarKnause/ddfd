const express = require('express');
const session = require('express-session');
const path = require('path');
const authMiddleware = require('./middleware/auth');

// Import routes
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const vacanciesRoutes = require('./routes/vacancies');
const resumesRoutes = require('./routes/resumes');
const cabinetRoutes = require('./routes/cabinet');
const chatRoutes = require('./routes/chat');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Session setup
app.use(session({
    secret: 'workheight-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Auth middleware - make user available in all templates
app.use(authMiddleware);

// Routes
app.use(indexRoutes);
app.use(authRoutes);
app.use(vacanciesRoutes);
app.use(resumesRoutes);
app.use(cabinetRoutes);
app.use(chatRoutes);
app.use(adminRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).render('index', { 
        title: 'Страница не найдена',
        vacancies: [],
        professions: ['Пескоструйщик', 'Маляр', 'Промышленный альпинист'],
        error: 'Страница не найдена'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).send('Произошла ошибка на сервере');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Admin login: admin@workheight.ru / admin123');
});

module.exports = app;
