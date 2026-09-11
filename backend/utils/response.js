const sendSuccessResponse = (
  res,
  data = {},
  message = "Operation completed Sucessfully",
  status_code = 200
) => {
  return res.status(status_code).json({
    success: true,
    message,
    data,
  });
};

const sendErrorResponse = (
  res,
  error = {},
  message = "Internal Server error",
  status_code = 500
) => {
  return res.status(status_code).json({
    success: false,
    message,
    error,
  });
};

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = {
  sendSuccessResponse,
  sendErrorResponse,
  AppError
};
