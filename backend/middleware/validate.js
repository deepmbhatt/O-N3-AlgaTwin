const {sendErrorResponse}=require('../utils/response')
const {STATUS_CODE}=require('../utils/constants')

const validate = (schemas={}) => {
  return (req, res, next) => {
    for (const [type, schema] of Object.entries(schemas)) {
      const { error, value } = schema.validate(req[type], {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        error.details.map((detail) => detail.message)
        return sendErrorResponse(res,error,"Validation failed",STATUS_CODE.VALIDATION_ERROR)
      }

      req[type] = value;
    }

    next();
  };
};

module.exports = validate;