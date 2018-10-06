var user = require('./../models/user');

var authenticate = (req, res, next) => {
  var token = req.header('x-auth');

  user.findByToken(token).then((user) => {
    if(user.rows[0] == null) {
      return Promise.reject();
    }

    req.user = user.rows[0];
    req.token = token;
    next();
  }).catch((e) => {
    console.log('here no one');
    res.status(401).send();
  });
}

module.exports = {authenticate};
