require('./config/config');

const _ = require('lodash');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const async = require('async');
const nodemailer = require('nodemailer');;

var express = require('express');
var bodyParser = require('body-parser');
var hbs = require('hbs');
var crypto = require('crypto');

var user = require('./models/user');

var {pool} = require('./db/postgresql');
var {authenticate} = require('./midleware/authenticate');
var {upload} = require('./midleware/upload');

var app = express();
const port = process.env.PORT;

app.set('view engine', 'hbs');
app.use(express.static('uploads'));
app.use(bodyParser.json());

app.post('/',(req, res) => {
  var body = _.pick(req.body, ['query'])

  pool.query("SELECT * FROM users WHERE LOWER(username) LIKE LOWER($1) ORDER BY LOWER(username)",
    ["%"+body.query+"%"]).then((result) => {
      res.status(200).send(result.rows);
    }).catch((e) => {
      console.log(e);
      res.status(400).send();
    })
});

app.post('/users', (req, res) => {
  var body = _.pick(req.body, ['name','username','email','password','telephone']);

  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(body.password, salt, (err, hash) => {
      if(validator.isEmail(body.email) && body.password.length >= 6){
        pool.query("INSERT INTO users(name, username, email, password, telephone) VALUES ($1,$2,$3,$4,$5)",
          [body.name, body.username, body.email, hash, body.telephone])
          .then((result) => {
            user.generateAuthToken(body.username)
              .then((token) => {
                res.header('x-auth', token).send();
              }).catch((e) => {
                res.status(400).send(e);
              });
          }).catch((e) => {
            res.status(400).send(e);
          });
      } else {
        res.status(400).send(body.email + ' is invalid email');
      }
    });
  });
});

app.post('/users/forgot', (req, res) => {
  async.waterfall([
    function(done) {
      crypto.randomBytes(5, function(err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function(token, done) {
      var email = req.body.email;
      pool.query("SELECT * FROM users WHERE email = $1",
        [email],(err, result) => {
          var _user = result.rows[0];
          user.newPasswordHash(email,token);

          done(err, token, _user);
        })
    },
    function(token, _user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
          user: 'invaderzgame@gmail.com',
          pass: process.env.GMAILPWD
        }
      });
      var mailOptions = {
        to: _user.email,
        from: 'invaderzgame@gmail.com',
        subject: 'SwapBook Password Reset นะจ๊ะ',
        text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
              'You new password is ' + token
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        if(err) {
          res.status(400).send('Unable to send mail', err);
        }
        res.status(200).send('An e-mail has been sent to ' + _user.email + ' with further instructions.');
      });
    }
  ])
});

app.post('/users/change', authenticate, (res, req) => {

});

app.get('/users/me', authenticate, (req, res) => {
  res.send(req.user);
});

app.post('/users/login', (req, res) => {
  var body = _.pick(req.body, ['login', 'password']);

  user.findByCredentials(body.login, body.password).then((users) => {
    return user.generateAuthToken(users.username).then((token) => {
      res.header('x-auth', token).send(users);
      console.log('POST /users/login');
    });
  }).catch((e) => {
    res.status(400).send();
  });
});

app.post('/books/upload',[authenticate, upload.single('bookImage')], (req, res) => {
  var body = _.pick(req.body,['book_name','description']);

  pool.query("INSERT INTO books(book_name, image, description, user_creator, status) VALUES ($1,$2,$3,$4,1)",
    [body.book_name, req.file.path, body.description, req.user.user_id])
    .then((result) => {
        res.status(201).json({
          message: "Uploaded book image successfully",
          uploadByUserId: req.user.user_id
        });
        console.log('POST /books/uploads');
    }).catch((e) => {
      console.log(e);
      res.status(400).send();
    });
});

app.get('/books/me', authenticate, (req, res) => {
  pool.query("SELECT * FROM books WHERE creator = $1 AND status = 1",
    [req.user.user_id])
    .then((result) => {
      res.status(200).send(result.rows);
      console.log('GET /books/me');
    }).catch((e) => {
      res.status(404).send();
    });
});

app.get('/books/:id', (req, res) => {
  var id = req.params.id;
  pool.query("SELECT * FROM books WHERE book_id=$1",
    [id])
    .then((result) => {
      res.status(200).send(result.rows);
      console.log('GET /books/:id');
    }).catch((e) => {
      res.status(404).send(e);
    });
});

app.delete('/books/:id', authenticate, (req, res) => {
  var id = req.params.id;
  pool.query("DELETE FROM books WHERE book_id=$1 AND user_creator = $2",
    [id,req.user.user_id])
    .then((result) => {
        res.status(200).send(result);
        console.log('DELETE /books/:id');
    }).catch((e) => {
        res.status(404).send();
    });
});

app.get('/books', authenticate, (req, res) => {
  pool.query("SELECT * FROM books WHERE status = 1 AND NOT user_creator = $1",
    [req.user.user_id]).then((result) => {
      res.status(200).send(result.rows);
      console.log('GET /books');
    }).catch((e) => {
      res.status(404).send();
    });
});

app.post('/search', authenticate, (req, res) => {
  var body = _.pick(req.body, ['query']);

  pool.query("SELECT * FROM books WHERE LOWER(book_name) LIKE LOWER($1) AND status = 1 AND NOT user_creator = $2 ORDER BY LOWER(book_name)",
    ["%"+body.query+"%", req.user.user_id]).then((result) => {
      res.status(200).send(result.rows);
    }).catch((e) => {
      console.log(e);
      res.status(400).send();
    })
});

app.get('/transaction/offer', authenticate, (req, res) => {
  pool.query("SELECT * FROM transaction WHERE user_offer = $1",
    [req.user.user_id]).then((result) => {
      res.status(200).send(result.rows);
    }).catch((e) => {
      res.status(400).send(e);
    });
});

app.get('/transaction/deal', authenticate, (req , res) => {
  pool.query("SELECT * FROM transaction WHERE user_deal = $1",
    [req.user.user_id]).then((result) => {
      res.status(200).send(result.rows);
    }).catch((e) => {
      res.status(400).send(e);
    });
});

app.post('/offer', authenticate, (req, res) => {
  var body = _.pick(req.body, ['user_deal','book_offer','book_deal']);
  if(req.user.user_id != body.user_deal) {
    pool .query("INSERT INTO transaction(user_offer, user_deal, book_offer, book_deal, status) VALUES  ($1,$2,$3,$4,2)",
      [req.user.user_id, body.user_deal, body.book_offer, body.book_deal]).then((result) => {
        pool.query("UPDATE books SET status = 2 WHERE book_id = $1",
          [body.book_offer]).then((update) => {
            res.status(200).json({
              message: "Offer Success"
            });
          }).catch((e) => {
            res.status(400).send(e);
          });
      }).catch((e) => {
        res.status(400).send(e);
      });
    } else {
      res.status(400).json({
        message: "You can't offer yourself"
      });
    }
});

app.get('/trade/info', (req, res) => {
  var body = _.pick(req.body, ['number']);
  var offer;
  var deal;

  pool.query("SELECT book_id, book_name, description, user_creator, type, image, user_id, name, username, email, telephone FROM books,transaction,users WHERE (books.book_id = transaction.book_offer) AND (transaction.user_offer = users.user_id)")
    .then((offer_info) => {
      offer = offer_info.rows[0];
      pool.query("SELECT book_id, book_name, description, user_creator, type, image, user_id, name, username, email, telephone FROM books,transaction,users WHERE (books.book_id = transaction.book_deal) AND (transaction.user_deal = users.user_id)")
        .then((deal_info) => {
          deal = deal_info.rows[0];
          res.status(200).json({deal,offer});
        }).catch((e) => {
          res.status(400).send(e);
        });
    }).catch((e) => {
      res.status(400).send(e);
    });
});

app.post('/trade', (req, res) => {
  var body = _.pick(req.body, ['number']); // transaction number

  pool.query("SELECT * FROM transaction WHERE number = $1",
    [body.number]).then((transaction) => {
      pool.query("UPDATE transaction SET status = 3 WHERE number = $1",
        [body.number]).then((result) => {
          pool.query("UPDATE books SET status = 3 WHERE book_id = $1",
            [transaction.rows[0].book_offer]).then((update1) => {
              pool.query("UPDATE books SET status = 3 WHERE book_id = $1",
                [transaction.rows[0].book_deal]).then((update2) => {
                  res.status(200).json({
                    message: "Update status successfully"
                  });
                }).catch((e) => {
                  res.status(400).send(e);
                });
            }).catch((e) => {
              res.status(400).send(e);
            });
        }).catch((e) => {
          res.status(400).send(e);
        });
  }).catch((e) => {
    res.status(400).send(e);
  });
});

app.listen(port, () => {
  console.log('Server Started at Port ' + port);
});
