const pg = require('pg');

var pool = new pg.Pool({
  user: 'majortom',
  host: 'localhost',
  database: 'swapbook2',
  password: '123456789',
  portget: '5432'
});

module.exports = {pool};
