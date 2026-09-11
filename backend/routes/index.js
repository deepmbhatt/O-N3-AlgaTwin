const express = require('express');

const router = express.Router();

const userRoutes = require('./api/user.routes');

router.use('/user', userRoutes);

router.get('/', (req, res) => {
  res.send('Welcome to the API');
});

module.exports = router;
