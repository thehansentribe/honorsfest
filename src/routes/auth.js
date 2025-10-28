const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = User.findByUsername(username);

  if (!user || !user.Active) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (!bcrypt.compareSync(password, user.PasswordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    {
      id: user.ID,
      username: user.Username,
      role: user.Role,
      firstName: user.FirstName,
      lastName: user.LastName,
      clubId: user.ClubID,
      eventId: user.EventID
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: user.ID,
      username: user.Username,
      role: user.Role,
      firstName: user.FirstName,
      lastName: user.LastName,
      clubId: user.ClubID,
      eventId: user.EventID,
      investitureLevel: user.InvestitureLevel
    }
  });
});

module.exports = router;


