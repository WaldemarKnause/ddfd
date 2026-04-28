module.exports = function authMiddleware(req, res, next) {
    res.locals.user = req.session.user || null;
    next();
};
