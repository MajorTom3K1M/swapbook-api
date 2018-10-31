const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');
var {pool} = require('.././db/postgresql');

var generateAuthToken = function (username) {
  return new Promise((resolve, reject) => {
    pool.query("SELECT user_id FROM users WHERE username = $1",[username])
      .then((result) => {
        var access = 'auth';
        var token = jwt.sign({id: result.rows[0].user_id, access},process.env.JWT_SECRET).toString();
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

var findByCredentials = function (login, password) {
  return pool.query("SELECT user_id,name,username,email,password,telephone FROM users WHERE email = $1 OR username = $1",[login])
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

  return pool.query("SELECT * FROM users WHERE user_id = $1 AND tokens->>'access' = 'auth' AND tokens->>'token' = $2",
    [decoded.id ,token]);
}

var newPasswordHash = function (user,password) {
  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(password, salt, (err, hash) => {
        console.log(password);
        console.log(hash);
        pool.query("UPDATE users SET password = $1 WHERE email = $2 OR username = $2",
          [hash,user])
          .then((result) => {
            console.log(password);
            return Promise.resolve();
          }).catch((e) => {
            return Promise.reject();
          });
    });
  });
}

module.exports = {generateAuthToken,findByCredentials,findByToken,newPasswordHash};
