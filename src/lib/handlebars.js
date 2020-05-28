const timeago = require("timeago.js");
const timeagoInstance = timeago();
const pool = require("../database");

const helpers = {};

helpers.timeago = savedTimestamp => {
  return timeagoInstance.format(savedTimestamp);
};

helpers.getEsMayorista = binario => {
  if (binario == 1) {
    return "Mayorista";
  } else if (binario == 0) {
    return "Minorista";
  } else {
    return "No definido";
  }
};

helpers.getProducto = async fkIdProducto => {
  const producto = await pool.query(
    "SELECT nombreProducto FROM producto WHERE pkIdProducto = ?",
    [fkIdProducto]
  );
  console.log("el producto es ", producto);
  console.log("el producto name es ", producto[0].nombreProducto);
  return producto[0].nombreProducto;
};

helpers.getSemestre = async () => {
  try {
    var semestre = 0;
    const rowsDirector = await pool.query(
      "SELECT semestreActual FROM director"
    );
    if (rowsDirector.length == 1) {
      semestre = rowsDirector[0].semestreActual;
    }
    return semestre;
  } catch (error) {
      console.log(error);
  }
};

module.exports = helpers;
