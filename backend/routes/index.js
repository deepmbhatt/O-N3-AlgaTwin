const express = require('express');

const router = express.Router();

const userRoutes = require('./api/user.routes');
const pondRoutes = require('./api/pond.routes');

router.use('/user', userRoutes);
router.use('/pond', pondRoutes);

router.get('/', (req, res) => {
  res.send('Welcome to the API');
});

module.exports = router;
