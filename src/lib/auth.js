const auth = {};


auth.esDirector = (req, res, next) => {
    if (req.isAuthenticated() && req.session.tipoUsuario == 1) {
        return next();
    }
    return res.redirect('/director/login');
};


auth.esEstudiante = (req, res, next) => {
    if (req.isAuthenticated() && req.session.tipoUsuario == 3) {
        return next();
    }
    return res.redirect('/estudiante/login');
};

module.exports=auth;