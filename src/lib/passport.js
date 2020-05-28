const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const pool = require('../database');
const helpers = require('./helpers');


//---- Director ---- //

passport.use('director.login', new LocalStrategy({
  usernameField: 'codigo',
  passwordField: 'password',
  passReqToCallback: true
}, async (req, codigo, password, done) => {
  try {

    //Consultar si existe el codigo ingresado en la tabla del Director
    const rowsDirector = await pool.query('SELECT fkIdUsuario FROM director WHERE codigoDirector = ?', [codigo]);
    var fkIdUsuario = 0;

    //Si la consulta arrojó al menos 1 resultado...
    if (rowsDirector.length > 0) {
      const director = rowsDirector[0];
      fkIdUsuario = director.fkIdUsuario;
      const temp = parseInt(fkIdUsuario, 10);
      fkIdUsuario = temp;
      console.log("el pkUsuario del fk es: ", fkIdUsuario);
    } else {
      done(null, false, req.flash('message', 'Código y/o contraseña incorrectos'));
    }

    //Consultar si las contraseñas coinciden
    const rowsUsuario = await pool.query('SELECT CAST(aes_decrypt(claveUsuario,"' + password + '")AS CHAR(200))claveUsuario FROM usuario WHERE pkIdUsuario =' + fkIdUsuario);
    if (rowsUsuario.length > 0) {
      const usuario = rowsUsuario[0];
      console.log("el usuario es: ", usuario);
      console.log("la clave desencriptada es:", usuario.claveUsuario);
      if (password == usuario.claveUsuario) {
        //Contraseñas coinciden 
        usuario.id = fkIdUsuario;
        req.session.tipoUsuario = 1;
        done(null, usuario);
      } else {
        //Contraseñas no coinciden
        done(null, false, req.flash('message', 'Código y/o contraseña incorrectos'));
      }
    } else {
      done(null, false, req.flash('message', 'Código y/o contraseña incorrectos'));
    }
  } catch (error) {
    console.log("error en director.login: ", error);
    done(null, false, req.flash('message', 'Código y/o contraseña incorrectos'));
  }
}));

//---- Estudiante ----//

passport.use('estudiante.registro', new LocalStrategy({
  usernameField: 'codigoEstudiante',
  passwordField: 'password',
  passReqToCallback: true
}, async (req, codigoEstudiante, password, done) => {
  try {
    const { dni, email, date } = req.body;
    //Verificar si existe pre-registro y si no existe registro aún
    const rowsPreregistro = await pool.query("SELECT nombresEstudiante, apellidosEstudiante, fkIdGrupo FROM preregistro WHERE pkCodigoEstudiante=?", [codigoEstudiante]);;
    const rowsRegistro = await pool.query("SELECT pfkCodigoEstudiante FROM estudiante WHERE pfkCodigoEstudiante=?", [codigoEstudiante]);
    if (rowsRegistro.length == 0 && rowsPreregistro.length == 1) {
      //Crear usuario
      const estudiante = rowsPreregistro[0];
      const fechaActual = new Date();
      const fechaRegistro = fechaActual.getFullYear() + "-" + (fechaActual.getMonth() + 1) + "-" + fechaActual.getDate();
      let newUser = {
        cedulaUsuario: dni,
        nombreUsuario: estudiante.nombresEstudiante,
        apellidoUsuario: estudiante.apellidosEstudiante,
        fechaRegistro,
        claveUsuario: password
      };

      //Registrar Usuario
      const resultUsuario = await pool.query('INSERT INTO usuario (claveUsuario,cedulaUsuario,nombreUsuario,apellidoUsuario,fechaRegistro) VALUES (aes_encrypt("' + password + '","' + password + '"),?,?,?,?) ',
        [dni, estudiante.nombresEstudiante, estudiante.apellidosEstudiante, fechaRegistro]);

      //Crear Estudiante
      const idUsuario = resultUsuario.insertId;
      let newEstudiante = {
        pfkCodigoEstudiante: codigoEstudiante,
        estaEnPracticas: 0,
        edadEstudiante: 22,
        semestreEstudiante: 9,
        fkIdUsuario: idUsuario,
        correoInstitucional: email
      };
      //Registrar Estudiante
      await pool.query("INSERT INTO estudiante SET ?", [newEstudiante]);

      //Incluir estudiante en un grupo
      const newEstudianteGrupo = {
        fkIdGrupo: estudiante.fkIdGrupo,
        fkCodigoEstudiante: codigoEstudiante
      }
      await pool.query("INSERT INTO estudiantegrupo SET ?", [newEstudianteGrupo]);
      req.session.tipoUsuario = 3;
      newUser.id = idUsuario;
      return done(null, newUser, req.flash('success', "Bienvenido"));
    } else {
      return done(null, null, req.flash('message', "Estudiante no pre-registrado o Estudiante ya registrado"));
    }

  } catch (error) {
    console.log(error);
    return done(null, null, req.flash('message', "Error al registrarse, verifique sus datos"));
  }
}));


passport.use('estudiante.login', new LocalStrategy({
  usernameField: 'codigo',
  passwordField: 'password',
  passReqToCallback: true
}, async (req, codigo, password, done) => {
  try {

    //Consultar si existe el codigo ingresado en la tabla del Director
    const rowsEstudiante = await pool.query('SELECT fkIdUsuario FROM estudiante WHERE pfkCodigoEstudiante  = ?', [codigo]);
    let fkIdUsuario = 0;

    //Si la consulta arrojó al menos 1 resultado...
    if (rowsEstudiante.length == 1) {
      const estudiante = rowsEstudiante[0];
      fkIdUsuario = estudiante.fkIdUsuario;
      console.log("el pkUsuario del fk es: ", fkIdUsuario);
    } else {
      done(null, false, req.flash('message', 'Código y/o contraseña incorrectos'));
    }

    //Consultar si las contraseñas coinciden
    const rowsUsuario = await pool.query('SELECT CAST(aes_decrypt(claveUsuario,"' + password + '")AS CHAR(200))claveUsuario FROM usuario WHERE pkIdUsuario =' + fkIdUsuario);
    if (rowsUsuario.length == 1) {
      const usuario = rowsUsuario[0];
      console.log("el usuario es: ", usuario);
      console.log("la clave desencriptada es:", usuario.claveUsuario);
      if (password == usuario.claveUsuario) {
        //Contraseñas coinciden 
        usuario.id = fkIdUsuario;
        req.session.tipoUsuario = 3;
        done(null, usuario);
      } else {
        //Contraseñas no coinciden
        done(null, false, req.flash('message', 'Código y/o contraseña incorrectos'));
      }
    } else {
      done(null, false, req.flash('message', 'Código y/o contraseña incorrectos'));
    }
  } catch (error) {
    console.log("error en director.login: ", error);
    done(null, false, req.flash('message', 'Código y/o contraseña incorrectos'));
  }
}));

// ---- Comun
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  const rows = await pool.query('SELECT * FROM usuario WHERE pkIdUsuario  = ?', [id]);
  done(null, rows[0]);
});

