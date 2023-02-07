'use strict';
/**
 * Module dependencies.
 */
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const bcrypt = require('bcrypt');
var session = require('express-session');
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const pgp = require('pg-promise')(/* options */)
var dbSecret = process.env.DBSECRET
// const db = pgp(`postgres://postgres:${dbSecret}@speedtest-expressdb.crfb1lzzct3l.ap-southeast-2.rds.amazonaws.com:5432/database`)
const db = pgp(`postgres://postgres:passwd@localhost`)
db.one('SELECT $1 AS value', 123)
  .then((data) => {
    console.log('DATA:', data.value)
  })
  .catch((error) => {
    console.log('ERROR:', error)
  })

var app = express();
const port = 3000

// config
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// middleware

app.use(express.urlencoded({ extended: false }))
app.use(session({
  resave: false, // don't save session if unmodified
  saveUninitialized: false, // don't create session until something stored
  secret: 'shhhh, very secret'
}));

// Session-persisted message middleware

app.use(function (req, res, next) {
  var err = req.session.error;
  var msg = req.session.success;
  delete req.session.error;
  delete req.session.success;
  res.locals.message = '';
  if (err) res.locals.message = '<p class="msg error">' + err + '</p>';
  if (msg) res.locals.message = '<p class="msg success">' + msg + '</p>';
  next();
});

// dummy database

var users = {
  tj: { 
    name: 'tj',
    salt: 'password',
    hashed: '',
   }
};
var password = 'password';
var hashedPassword = '';
// when you create a user, generate a salt
// and hash the password ('foobar' is the pass here)

async function hashIt(password) {
  const salt = await bcrypt.genSalt(6);
  const hashed = await bcrypt.hash(password, salt);
  users.tj.salt = salt;
  users.tj.hashed = hashed;
}
hashIt(password);
// compare the password user entered with hashed pass.
async function compareIt(password) {
  const validPassword = await bcrypt.compare(password, hashedPassword);
}
compareIt(password);

// hash({ password: 'foobar' }, function (err, pass, salt, hash) {
//   if (err) throw err;
//   // store the salt & hash in the "db"
//   users.tj.salt = salt;
//   users.tj.hash = hash;
// });


// Authenticate using our plain-object database of doom!

function authenticate(name, pass, fn) {
  if (!module.parent) console.log('authenticating %s:%s', name, pass);
  var user = users[name];
  // query the db for the given username
  if (!user) return fn(null, null)
  // apply the same algorithm to the POSTed password, applying
  // the hash against the pass / salt, if there is a match we
  // found the user
  hashIt({ password: pass, salt: user.salt }
    // , function (err, pass, salt, hash) {
    // if (err) return fn(err);
    // if (hash === user.hash) return fn(null, user)
    // fn(null, null) }
  );
}

function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}

// app.get('/', function (req, res) {
//   res.redirect('/login');
// });

app.get('/restricted', restrict, function (req, res) {
  res.send('Wahoo! restricted area, click to <a href="/logout">logout</a>');
});

app.get('/logout', function (req, res) {
  // destroy the user's session to log them out
  // will be re-created next request
  req.session.destroy(function () {
    res.redirect('/');
  });
});

app.get('/login', function (req, res) {
  res.render('login');
});

app.post('/login', function (req, res, next) {
  authenticate(req.body.username, req.body.password, function (err, user) {
    if (err) return next(err)
    if (user) {
      // Regenerate session when signing in
      // to prevent fixation
      req.session.regenerate(function () {
        // Store the user's primary key
        // in the session store to be retrieved,
        // or in this case the entire user object
        req.session.user = user;
        req.session.success = 'Authenticated as ' + user.name
          + ' click to <a href="/logout">logout</a>. '
          + ' You may now access <a href="/restricted">/restricted</a>.';
        res.redirect('back');
      });
    } else {
      req.session.error = 'Authentication failed, please check your '
        + ' username and password.'
        + ' (use "tj" and "foobar")';
      res.redirect('/login');
    }
  });
});



app.get('/', (req, res) => {
  res.send('Hello World!')
})
app.post('/', (req, res) => {
  res.send('Got a POST request')
})
app.put('/user', (req, res) => {
  res.send('Got a PUT request at /user')
})
app.delete('/user', (req, res) => {
  res.send('Got a DELETE request at /user')
})
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

/* Listened port */
if (!module.parent) {
  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
  });
}

module.exports = app;
