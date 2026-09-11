const User = require("../models/users");


async function findUserByEmail(email) {
  return User.findOne({ email });
}


async function createNewUser(userData) {
  const { name, email, password } = userData;

  const newUser = await User.create({
    name,
    email,
    password
  });

  return newUser;
}


module.exports = {
  findUserByEmail,
  createNewUser
};
