var user = require('./../models/user');

var authenticate = (req, res, next) => {
  var token = req.header('x-auth');

  user.findByToken(token).then((user) => {
    //console.log(user);
    if(user.rows[0] == null) {
      return Promise.reject();
    }

    req.user = user.rows[0];
    req.token = token;
    next();
  }).catch((e) => {
    res.status(401).send();
  });
}

module.exports = {authenticate};
