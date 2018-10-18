require('./config/config');

const _ = require('lodash');
const validator = require('validator');
const bcrypt = require('bcryptjs');

var express = require('express');
var bodyParser = require('body-parser');
var hbs = require('hbs');

var user = require('./models/user');

var {pool} = require('./db/postgresql');
var {authenticate} = require('./midleware/authenticate');
var {upload} = require('./midleware/upload');

var app = express();
const port = process.env.PORT;

app.set('view engine', 'hbs');
app.use(express.static('uploads'));
app.use(bodyParser.json());

app.post('/users', (req, res) => {
  var body = _.pick(req.body, ['username','email','password']);

  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(body.password, salt, (err, hash) => {
      if(validator.isEmail(body.email) && body.password.length >= 6){
        pool.query("INSERT INTO users(username, email, password) VALUES ($1,$2,$3)",
          [body.username, body.email, hash])
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

app.get('/users/me', authenticate, (req, res) => {
  res.send(req.user);
});

app.post('/users/login', (req, res) => {
  var body = _.pick(req.body, ['email', 'password']);

  user.findByCredentials(body.email, body.password).then((users) => {
    return user.generateAuthToken(users.username).then((token) => {
      res.header('x-auth', token).send(users);
    });
  }).catch((e) => {
    res.status(400).send();
  });
});

app.post('/books/uploads',[authenticate, upload.single('bookImage')], (req, res) => {
  pool.query("INSERT INTO books(bookimage, creator) VALUES ($1,$2)",
    [req.file.path, req.user.id])
    .then((result) => {
        res.status(201).json({
          message: "Uploaded book image successfully",
          uploadByUserId: req.user.id
        });
    }).catch((e) => {
      console.log(e);
      res.status(400).send();
    });
});

app.get('/books/me', authenticate, (req, res) => {
  pool.query("SELECT * FROM books WHERE creator = $1",
    [req.user.id])
    .then((result) => {
      res.status(200).send(result.rows);
    }).catch((e) => {
      res.status(404).send();
    });
});

app.get('/books/:id', (req, res) => {
  var id = req.params.id;
  pool.query("SELECT * FROM books WHERE id=$1",
    [id])
    .then((result) => {
      res.status(200).send(result.rows);
    }).catch((e) => {
      res.status(404).send();
    });
});

app.delete('/books/:id', authenticate, (req, res) => {
  var id = req.params.id;
  pool.query("DELETE FROM books WHERE id=$1",
    [id])
    .then((result) => {
        res.status(200).send(result);
    }).catch((e) => {
        res.status(404).send();
    });
});

app.get('/books', (req, res) => {
  pool.query("SELECT * FROM books")
    .then((result) => {
      res.status(200).send(result.rows);
    }).catch((e) => {
      res.status(404).send();
    });
});

app.listen(port, () => {
  console.log('Server Started at Port 3000');
});
