const express = require("express");
const router = express.Router();

const passport = require("passport");
const pool = require("../database");
const { esEstudiante } = require("../lib/auth");
const helpers = require("../lib/helpers");
const nodemailer = require("nodemailer");
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const uuid = require('uuid/v4');

// SIGNUP
router.get("/registro", (req, res) => {
  res.render("estudiante/registro");
});

router.post(
  "/registro",
  passport.authenticate("estudiante.registro", {
    successRedirect: "/estudiante/index",
    failureRedirect: "/estudiante/registro",
    failureFlash: true
  })
);

//SIGNIN
router.get("/login", (req, res) => {
  res.render("estudiante/login");
});

router.post("/login", (req, res, next) => {
  req.check("codigo", "Código es requerido").notEmpty();
  req.check("password", "Contraseña es requerida").notEmpty();
  const errors = req.validationErrors();
  if (errors.length > 0) {
    req.flash("message", errors[0].msg);
    res.redirect("/estudiante/login");
  }
  passport.authenticate("estudiante.login", {
    successRedirect: "/estudiante/index",
    failureRedirect: "/estudiante/login",
    failureFlash: true
  })(req, res, next);
});

router.get("/cerrarLogin", esEstudiante, (req, res) => {
  req.logOut();
  res.redirect("/");
});

// ----- NEGOCIO -------
router.get("/index", esEstudiante, async (req, res) => {
  try {

    const rowsUsuario = await pool.query("SELECT usuario.fkIdImg, usuario.direccionUsuario, usuario.correoUsuario, usuario.telefonoUsuario, estudiante.semestreEstudiante, usuario.nombreUsuario, usuario.apellidoUsuario, usuario.fechaNacimiento, estudiante.descripcionPersonalizada, estudiante.pfkCodigoEstudiante FROM usuario INNER JOIN estudiante ON usuario.pkIdUsuario=estudiante.fkIdUsuario WHERE usuario.pkIdUsuario = ?",
      [req.session.passport.user]);
    var estudiante = rowsUsuario[0];

    const fkIdImg = rowsUsuario[0].fkIdImg;
    if (fkIdImg != undefined) {
      const rowsImg = await pool.query("SELECT rutaImg FROM imagen WHERE pkIdImg=?", [fkIdImg]);
      estudiante.rutaImg = rowsImg[0].rutaImg;
    }



    const rowsInformes = await pool.query("SELECT pkIdInforme,nombreInforme,fechaSubida FROM informe WHERE fkCodigoEstudiante=?", [estudiante.pfkCodigoEstudiante]);


    res.render("estudiante/index", { estudiante, rowsInformes });
  } catch (error) {

  }
});

router.get("/editarPerfil", esEstudiante, async (req, res) => {
  try {
    const rowsUsuario = await pool.query(
      "SELECT usuario.correoUsuario, usuario.telefonoUsuario, usuario.direccionUsuario, estudiante.descripcionPersonalizada, estudiante.semestreEstudiante    FROM usuario INNER JOIN estudiante ON usuario.pkIdUsuario=estudiante.fkIdUsuario  WHERE usuario.pkIdUsuario =?",
      [req.session.passport.user]
    );
    const usuario = rowsUsuario[0];

    res.render("estudiante/editarPerfil", { usuario });
  } catch (error) {
    console.log(error);
    req.flash("message", "Error mostrando edición de perfil");
    res.redirect("/estudiante/index");
  }
});

router.post("/editarPerfil", esEstudiante, async (req, res) => {
  try {
    const { email, telefono, direccion, descripcion, semestre } = req.body;
    const idUsuario = req.session.passport.user;

    const nuevoUsuario = {
      correoUsuario: email,
      telefonoUsuario: telefono,
      direccionUsuario: direccion
    };
    await pool.query("UPDATE usuario SET ? WHERE pkIdUsuario=?", [
      nuevoUsuario,
      idUsuario
    ]);

    const nuevoEstudiante = {
      descripcionPersonalizada: descripcion,
      semestreEstudiante: semestre
    };
    await pool.query("UPDATE estudiante SET ? WHERE fkIdUsuario=?", [
      nuevoEstudiante,
      idUsuario
    ]);
    res.redirect("/estudiante/index");
  } catch (error) {
    console.log(error);
    req.flash("message", "Error editando perfil");
    res.redirect("/estudiante/index");
  }
});

router.get("/recuperarClave", (req, res) => {
  res.render("estudiante/recuperarClave");
});

router.post("/recuperarClave", async (req, res) => {
  try {
    const { codigo, email } = req.body;
    //Consultar si existe el codigo ingresado en la tabla del Estudiante
    const rowsEstudiante = await pool.query(
      "SELECT fkIdUsuario,correoInstitucional FROM estudiante WHERE pfkCodigoEstudiante = ?",
      [codigo]
    );
    let fkIdUsuario = 0;

    //Si la consulta arrojó al menos 1 resultado...
    if (rowsEstudiante.length == 1) {
      const estudiante = rowsEstudiante[0];
      fkIdUsuario = estudiante.fkIdUsuario;
    } else {
      req.flash("message", "CÓDIGO y/o CORREO incorrectos");
      res.redirect("/estudiante/index");
    }

    const estudiante = rowsEstudiante[0];
    if (email == estudiante.correoInstitucional) {
      //Correos coinciden, crear nuvea clave
      const nuevaClave = Math.random()
        .toString(36)
        .substring(7);
      //Actualizar clave
      await pool.query(
        'UPDATE usuario SET claveUsuario = (aes_encrypt("' +
        nuevaClave +
        '","' +
        nuevaClave +
        '")) WHERE pkIdUsuario=' +
        fkIdUsuario +
        ";"
      );
      //Enviar correo con la clave
      contentHTML = `
        <h1>Estudiante, su nueva clave es</h1>
        <p>${nuevaClave}</p>
  
    `;
      //Configurar Emisor
      let emisor = nodemailer.createTransport({
        host: "mail.lamegaplaza.com",
        port: 587,
        secure: false,
        auth: {
          user: "prami@lamegaplaza.com",
          pass: "pramipassprami"
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      //configurar Receptor
      const receptor = {
        from: '"Prami" <prami@lamegaplaza.com>', // sender address,
        to: email,
        subject: "Recuperar contraseña",
        // text: 'Contenido'
        html: contentHTML
      };
      //Enviar correo
      let info = await emisor.sendMail(receptor);

      console.log("Message sent: %s", info.messageId);
      // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

      // Preview only available when sending through an Ethereal account
      console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
      // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...

      req.flash(
        "success",
        "Datos enviados, por favor revise su correo electrónico"
      );
      res.redirect("/estudiante/index");
    } else {
      //Correos no coinciden
      req.flash("message", "CÓDIGO y/o CORREO incorrectos");
      res.redirect("/estudiante/index");
    }
  } catch (error) {
    console.log("error recuperando clave: ", error);
    res.redirect("/");
  }
});

//Subir foto de perfil

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../public/uploads'),
  filename: (req, file, cb) => {
    cb(null, uuid() + path.extname(file.originalname));
  }
});

const subirFoto = multer({
  storage,
  fileFilter: function (req, file, cb) {

    try {
      var filetypes = /jpg|jpeg|png|webp/;
      var mimetype = filetypes.test(file.mimetype);
      var extname = filetypes.test(path.extname(file.originalname).toLowerCase());

      if (mimetype && extname) {
        return cb(null, true);
      }
      cb("Error: Solo se permiten archivos con extensión: - " + filetypes);
    } catch (error) {
      console.log(error);
    }
  },
  limits: { fileSize: 10000000 },
}).single("profileimg");

router.post('/subirFotoPerfil', esEstudiante, async (req, res) => {
  try {
    subirFoto(req, res, async (err) => {
      const idUsuario = req.session.passport.user;
      const rutaImg = req.file.filename;
      const imagen = { rutaImg };
      const insertImg = await pool.query("INSERT INTO imagen SET ?", [imagen]);
      const fkIdImg = insertImg.insertId;
      const usuario = { fkIdImg };
      await pool.query("UPDATE usuario SET ?  WHERE pkIdUsuario=? ", [usuario, idUsuario]);

      req.flash("success", "Foto cargada");
      res.redirect('/estudiante/index');
    });
  } catch (error) {
    console.log(error);
    req.flash("message", "Error procesando imagen");
    res.redirect('/estudiante/index');
  }
});

//Agregar informe
router.get("/agregarInforme", (req, res) => {
  res.render("estudiante/agregarInforme");
});

const agregarInforme = multer({
  storage,
  fileFilter: function (req, file, cb) {

    var filetypes = /pdf|pdf/;
    var mimetype = filetypes.test(file.mimetype);
    var extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb("Error: Solo se permiten archivos con extensión: - " + filetypes);
  },
  limits: { fileSize: 10000000 },
}).single("informefile");

router.post('/agregarInforme', esEstudiante, async (req, res) => {

  try {
    agregarInforme(req, res, async (err) => {

      const idUsuario = req.session.passport.user;
      const fechaActual = new Date();

      const rowsEstudiante = await pool.query("SELECT pfkCodigoEstudiante FROM estudiante WHERE fkIdUsuario=?", [idUsuario]);

      const rutaInforme = req.file.filename;
      const nombreInforme = req.file.originalname.split(".")[0];
      const fkCodigoEstudiante = rowsEstudiante[0].pfkCodigoEstudiante;
      const fechaSubida = fechaActual.getFullYear() + "-" + (fechaActual.getMonth() + 1) + "-" + fechaActual.getDate();
      const informe = { nombreInforme, rutaInforme, fkCodigoEstudiante, fechaSubida };
      await pool.query("INSERT INTO informe SET ?", [informe]);


      req.flash("success", "Informe cargado");
      res.redirect('/estudiante/index');
    });
  } catch (error) {
    console.log(error);
    req.flash("message", "Error procesando archivo");
    res.redirect('/estudiante/index');
  }
});

//Ver informe
router.get("/informe/:id", async (req, res) => {
  try {
    const { id } = req.params;



    const rowsInforme = await pool.query("SELECT informe.nombreInforme, informe.rutaInforme, informe.fechaSubida FROM informe WHERE pkIdInforme= ?", [id]);

    const informe = rowsInforme[0];

    res.render("estudiante/informe", { informe });
  } catch (error) {
    console.log(error);
    req.flash("message", "Error procesando archivo");
    res.redirect('/estudiante/index');
  }
});

//Agregar hoja de vida
router.get("/agregarInforme", (req, res) => {
  res.render("estudiante/agregarInforme");
});

const agregarHojaDeVida = multer({
  storage,
  fileFilter: function (req, file, cb) {

    var filetypes = /pdf|pdf/;
    var mimetype = filetypes.test(file.mimetype);
    var extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb("Error: Solo se permiten archivos con extensión: - " + filetypes);
  },
  limits: { fileSize: 10000000 },
}).single("informefile");

router.post('/agregarInforme', esEstudiante, async (req, res) => {

  try {
    agregarHojaDeVida(req, res, async (err) => {

      req.flash("success", "Hoja de vida cargada");
      res.redirect('/estudiante/index');
    });
  } catch (error) {
    console.log(error);
    req.flash("message", "Error procesando archivo");
    res.redirect('/estudiante/index');
  }
});
module.exports = router;
