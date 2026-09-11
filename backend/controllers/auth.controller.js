const { sendSuccessResponse, AppError } = require("../utils/response");
const asyncHandler = require("../middleware/asyncHandler");
const { STATUS_CODE } = require("../utils/constants");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const service = require("../services/auth.service");

const jwtSecret = process.env.JWT_SECRET || "your_jwt_secret";


const Login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await service.findUserByEmail(email);

  if (!user) {
    throw new AppError(
      "Invalid Credentials",
      STATUS_CODE.UNAUTHORIZED
    );
  }

  const validatePassword = await bcrypt.compare(
    password,
    user.password
  );

  if (!validatePassword) {
    throw new AppError(
      "Invalid Credentials",
      STATUS_CODE.UNAUTHORIZED
    );
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email
    },
    jwtSecret,
    {
      expiresIn: "24h"
    }
  );

  return sendSuccessResponse(
    res,
    {
      token,
      email
    },
    "Logged In Successfully",
    STATUS_CODE.SUCCESS
  );
});


const Signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existingUser = await service.findUserByEmail(email);

  if (existingUser) {
    throw new AppError(
      "User Already Exists",
      STATUS_CODE.CONFLICT
    );
  }

  const user = await service.createNewUser({
    name,
    email,
    password
  });

  return sendSuccessResponse(
    res,
    user,
    "User Created Successfully",
    STATUS_CODE.CREATED
  );
});


module.exports = {
  Login,
  Signup
};
