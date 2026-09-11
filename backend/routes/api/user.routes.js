const express = require('express');
const router = express.Router();

const Joi = require('joi');

const authControllers = require('../../controllers/auth.controller');
const userControllers = require('../../controllers/user.controller');

const auth = require('../../middleware/auth');
const validate = require('../../middleware/validate');


const createUserSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});


const updateUserSchema = Joi.object({
  name: Joi.string(),
  email: Joi.string().email(),
  password: Joi.string().min(6)
});


const listUserSchema = Joi.object({
  page: Joi.number().integer().min(1).required(),
  limit: Joi.number().integer().min(1).max(100).required(),
  search: Joi.object({
    name: Joi.string()
  }).optional()
});


const idUserSchema = Joi.object({
  id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
});


router.route('/')
  .get(
    auth,
    validate({ query: listUserSchema }),
    userControllers.getAllUsers
  )


router.post(
  '/login',
  validate({
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required()
    })
  }),
  authControllers.Login
);


router.post(
  '/signup',
  validate({ body: createUserSchema }),
  authControllers.Signup
);


router.route('/:id')
  .get(
    auth,
    validate({ params: idUserSchema }),
    userControllers.getUserById
  )
  .patch(
    auth,
    validate({ params: idUserSchema, body: updateUserSchema }),
    userControllers.editUser
  )
  .delete(
    auth,
    validate({ params: idUserSchema }),
    userControllers.deleteUser
  );


module.exports = router;
