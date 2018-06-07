const db = require('sqlite');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const hat = require('hat');
const bcrypt = require('bcrypt');
const session = require('express-session');

const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

// DATABASE
db.open('expressapi.db').then(() => {
  db.run('CREATE TABLE IF NOT EXISTS users (pseudo, email, firstname, lastname, password, id, createdAt, updatedAt)')
    .then(() => {
      console.log('> Database ready')
    }).catch((err) => { // Si on a eu des erreurs
    console.error('ERR> ', err)
  })
});

app.set('views', './views');
app.set('view engine', 'pug');

app.set('trust proxy',1);
app.use(session({
  secret:'topkek',
  resave:false,
  saveUninitialized:true,
  cookie: {
    maxAge:1000 * 60 * 60,
    httpOnly:true
  }
}));

// BODY PARSER
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

// Override POST
app.use(methodOverride('_method'));

// LOGGER
app.use((req, res, next) => {
  next();
  console.log('REQUEST: ' + req.method + ' ' + req.url)
});

// DEFAULT ROUTE
app.get('/', (req, res, next) => {
  res.format({
    html: () => { res.send('<h1>Bienvenue sur notre superbe API!</h1>') },
    json: () => { res.send({ message: 'Bienvenue sur notre superbe API!' }) }
  })
});

// GET ALL USERS
app.get('/users', (req, res, next) => {
  const wheres = [];

  if (req.query.firstname) {
    wheres.push(`firstname LIKE '%${req.query.firstname}%'`)
  }

  if (req.query.lastname) {
    wheres.push(`lastname LIKE '%${req.query.lastname}%'`)
  }

  const limit = `LIMIT ${req.query.limit || 100}`;
  const offset = `OFFSET ${ req.query.offset || 0}`;
  const where = wheres.length > 0 ? `WHERE ${wheres.join(' AND ')}` : '';
  let order = '';
  let reverse = '';
  if (req.query.order && req.query.reverse) {
    order = `ORDER BY ${req.query.order}`;
    if (req.query.reverse === '1') {
      reverse = 'DESC'
    } else if (req.query.reverse === '0') {
      reverse = 'ASC'
    }
  }

  query = `SELECT * FROM users ${where} ${order} ${reverse} ${limit} ${offset}`;

  db.all(query)
    .then((users) => {
      res.format({
        html: () => { res.render('users/index', { users: users }) },
        json: () => { res.send(users) }
      })
    }).catch(next)
});

// VIEW: ADD USER
app.get('/users/add', (req, res, next) => {
  res.format({
    html: () => {
      res.render('users/edit', {
        title: 'Ajouter un utilisateur',
        user: {},
        action: '/users'
      })
    },
    json: () => {
      next(new Error('Bad request'))
    }
  })
});

// VIEW: EDIT USER
app.get('/users/:userId/edit', (req, res, next) => {
  res.format({
    html: () => {
      db.get('SELECT * FROM users WHERE id = ?', req.params.userId)
        .then((user) => {
          if (!user) next();
          res.render('users/edit', {
            title: 'Editer un utilisateur',
            user: user,
            action: '/users/' + req.params.userId + '?_method=put',
          })
        })
    },
    json: () => {
      next(new Error('Bad request'))
    }
  })
});

// GET USER BY ID
app.get('/users/:userId', (req, res, next) => {
  db.get('SELECT * FROM users WHERE id = ?', req.params.userId)
    .then((user) => {
      res.format({
        html: () => { res.render('users/show', { user: user }) },
        json: () => { res.status(201).send({message: 'success'}) }
      })
    }).catch(next)
});

// POST USER
app.post('/users', (req, res, next) => {
  console.log(req.body);
  if(!req.body.pseudo || !req.body.email || !req.body.firstname || !req.body.lastname || !req.body.password) {
    next(new Error('All fields must be given.'));
    return
  }

  bcrypt.hash(req.body.password, 10).then((password) => {
    return db.run(
      "INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      req.body.pseudo,
      req.body.email,
      req.body.firstname,
      req.body.lastname,
      password,
      hat(),
      new Date(),
      null
    )
  }).then(() => {
      res.format({
        html: () => { res.redirect('/users') },
        json: () => { res.status(201).send({message: 'success'}) }
      })
    }).catch(next)
});

// DELETE USER
app.delete('/users/:userId', (req, res, next) => {
  db.run('DELETE FROM users WHERE id = ?', req.params.userId)
    .then(() => {
      res.format({
        html: () => { res.redirect('/users') },
        json: () => { res.status(201).send({message: 'success'}) }
      })
    }).catch(next)
});

// UPDATE USER
app.put('/users/:userId', (req, res, next) => {
  db.run(
    "UPDATE users SET pseudo = ?, email = ?, firstname = ?, lastname = ?, password = ?, updatedAt= ? WHERE id = ?",
    req.body.pseudo,
    req.body.email,
    req.body.firstname,
    req.body.lastname,
    req.body.password,
    new Date(),
    req.params.userId
  )
    .then(() => {
      res.format({
        html: () => { res.redirect('/users') },
        json: () => { res.status(201).send({message: 'success'}) }
      })
    }).catch(next)
});

// ERROR
app.use((err, req, res, next) => {
  console.log('ERR: ' + err);
  res.status(500);
  res.format({
    html: () => {
      res.end('Server Error')
    },
    json: () => {
      res.send({status: 500, message: err})
    }
  })
});

// 501
app.use((req, res) => {
  res.format({
    html: () => {
      res.render('501')
    },
    json: () => {
      res.status(501);
      res.send({status: 501, message: 'Not implemented'})
    }
  })
});

app.listen(PORT, () => {
  console.log('Server running on port: ' + PORT)
});