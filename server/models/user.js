const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');
var {pool} = require('.././db/postgresql');

var generateAuthToken = function (username) {
  return new Promise((resolve, reject) => {
    pool.query("SELECT id FROM users WHERE username = $1",[username])
      .then((result) => {
        var access = 'auth';
        var token = jwt.sign({id: result.rows[0].id, access},process.env.JWT_SECRET).toString();
        pool.query("UPDATE users SET tokens = $1 WHERE username = $2",
          [`{\"access\" : \"${access}\" , \"token\": \"${token}\"}`,username])
          .then((result) => {
            resolve(token);
          }).catch((e) => reject(e));
        }).catch((e) => {
          reject(e);
        });
    });
};

var findByCredentials = function (email, password) {
  return pool.query("SELECT * FROM users WHERE email = $1",[email])
    .then((user) => {
      if(user.rows[0] == null) { //email are wrong
        return Promise.reject();
      }


      return new Promise((resolve, reject) => {
        bcrypt.compare(password,user.rows[0].password.replace(/ /g,''),(err, res) => {
          if(res) { //password are wrong
            return resolve(user.rows[0]);
          } else {
            return reject();
          }
        });
      });
    });
}

var findByToken = function (token) {
  var decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch(e) {
    return Promise.reject();
  }

  return pool.query("SELECT * FROM users WHERE id = $1 AND tokens->>'access' = 'auth' AND tokens->>'token' = $2",
    [decoded.id,token]);
}

module.exports = {generateAuthToken,findByCredentials,findByToken};
