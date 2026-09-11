const User = require("../models/users");
const { AppError } = require("../utils/response");
const { STATUS_CODE } = require("../utils/constants");


async function fetchUserById(userId) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(
      "User Not Found",
      STATUS_CODE.NOT_FOUND
    );
  }

  return user;
}


async function deleteUser(userId) {
  const deletedUser = await User.findByIdAndDelete(userId);

  if (!deletedUser) {
    throw new AppError(
      "User Not Found",
      STATUS_CODE.NOT_FOUND
    );
  }

  return deletedUser;
}


async function getAllUsers(queryParams) {
  const { page, limit, nameSearch } = queryParams;

  const offset = (page - 1) * limit;

  const whereClause = {};

  if (nameSearch) {
    whereClause.name = {
      $regex: nameSearch,
      $options: "i"
    };
  }

  const users = await User
    .find(whereClause)
    .skip(offset)
    .limit(limit);

  const totalUsers = await User.countDocuments(whereClause);
  const totalPages = Math.ceil(totalUsers / limit);

  return {
    data: users,
    pagination: {
      totalUsers,
      totalPages,
      currentPage: page,
      limit
    }
  };
}


async function updateUser(userId, updateFields) {
  const cleanedFields = {};

  for (const key in updateFields) {
    if (updateFields[key] !== undefined) {
      cleanedFields[key] = updateFields[key];
    }
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $set: cleanedFields },
    {
      new: true
    }
  );

  if (!updatedUser) {
    throw new AppError(
      "User Not Found",
      STATUS_CODE.NOT_FOUND
    );
  }

  return updatedUser;
}


module.exports = {
  fetchUserById,
  deleteUser,
  getAllUsers,
  updateUser
};
