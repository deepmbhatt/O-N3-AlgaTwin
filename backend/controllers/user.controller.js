const { sendSuccessResponse } = require("../utils/response");
const asyncHandler = require("../middleware/asyncHandler");
const { STATUS_CODE } = require("../utils/constants");
const service = require("../services/user.service");


const getAllUsers = asyncHandler(async (req, res) => {
  const { page, limit, name } = req.query;

  const allUsers = await service.getAllUsers({
    page,
    limit,
    nameSearch: name
  });

  return sendSuccessResponse(
    res,
    {
      users: allUsers.data,
      pagination: allUsers.pagination
    },
    "Users Retrieved Successfully",
    STATUS_CODE.OK
  );
});


const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await service.fetchUserById(id);

  return sendSuccessResponse(
    res,
    user,
    "User Retrieved Successfully",
    STATUS_CODE.OK
  );
});


const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deletedUser = await service.deleteUser(id);

  return sendSuccessResponse(
    res,
    deletedUser,
    "User Deleted Successfully",
    STATUS_CODE.OK
  );
});


const editUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const updatedUser = await service.updateUser(
    id,
    req.body
  );

  return sendSuccessResponse(
    res,
    updatedUser,
    "User Updated Successfully",
    STATUS_CODE.OK
  );
});


module.exports = {
  getAllUsers,
  getUserById,
  deleteUser,
  editUser
}