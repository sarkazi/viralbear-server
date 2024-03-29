const User = require("../entities/User");
const RecoveryLinks = require("../entities/RecoveryLinks");
const md5 = require("md5");
const moment = require("moment");
const { genSalt, hash: hashBcrypt } = require("bcryptjs");

const mailTransporter = require("../nodemailer.instance");

const sendEmailPassword = async (email, subjectText, textEmail, htmlText) => {
  await mailTransporter.sendMail({
    from: '"Information" <info@viralbear.media>',
    to: email,
    subject: subjectText,
    text: textEmail,
    html: htmlText,
  });
};

const getAllUsers = async ({
  me,
  userId,
  roles,
  canBeAssigned,
  fieldsInTheResponse,
  members,
  exist,
  displayOnTheSite,
  skip,
  limit,
  hiddenForEditor,
  sort,
  test,
}) => {
  return await User.find(
    {
      inTheArchive: { $ne: true },
      ...(me && JSON.parse(me) === false && { _id: { $ne: userId } }),
      ...(roles?.length && { role: { $in: roles } }),
      ...(test && {
        $or: [
          {
            email: { $regex: test, $options: "i" },
          },
          {
            name: { $regex: test, $options: "i" },
          },
        ],
      }),

      ...(exist?.length &&
        exist.reduce((a, v) => ({ ...a, [v]: { $exists: true } }), {})),
      ...(canBeAssigned &&
        typeof JSON.parse(canBeAssigned) === "boolean" && {
          canBeAssigned: JSON.parse(canBeAssigned),
        }),
      ...(displayOnTheSite && {
        displayOnTheSite,
      }),
      ...(typeof hiddenForEditor === "boolean" && {
        hiddenForEditor,
      }),
      ...(members && { [members.searchBy]: { $in: members.value } }),
    },
    {
      ...(fieldsInTheResponse &&
        fieldsInTheResponse.reduce((a, v) => ({ ...a, [v]: 1 }), {})),
    }
  )
    .collation(
      skip && limit ? { locale: "en_US", numericOrdering: true } : null
    )
    .limit(limit ? limit : null)
    .skip(skip ? skip : null)
    .sort(sort === "desc" ? { _id: -1 } : sort === "asc" ? { _id: 1 } : null);
  // .count((err, count) => {console.log(err, count)})
};

const getUserById = async (userId) => {
  return await User.findOne({ _id: userId });
};

const getUserByEmail = async (email) => {
  return await User.findOne({ email });
};

const findUsersByEmails = async (emails) => {
  return await User.find({
    email: { $in: emails },
  });
};

const deleteUser = async (userId) => {
  await User.deleteOne({ _id: userId });
};

const getUserBy = async ({ searchBy, value, fieldsInTheResponse }) => {
  return await User.findOne(
    { [searchBy]: value },
    {
      ...(fieldsInTheResponse &&
        fieldsInTheResponse.reduce((a, v) => ({ ...a, [v]: 1 }), {})),
    }
  );
};

const sendPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const recoveryData = await RecoveryLinks.findOne({ email });

    if (recoveryData) {
      await recoveryData.deleteOne({});
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(200)
        .json({ message: "User is not found", status: "warning" });
    }

    if (!!user.inTheArchive) {
      return res.status(200).json({
        message: "Your account is blocked. Contact the administrator",
        status: "warning",
      });
    }

    const tailHashLink = md5(`${user.email}${user.password}`) + Date.now();

    await RecoveryLinks.create({
      email: user.email,
      hash: tailHashLink,
    });

    sendEmailPassword(
      user.email,
      'Password recovery for "Viral Bear"',
      `Password recovery for "Viral Bear"`,
      `<a href="${process.env.CLIENT_URI}/login?rec_hash=${tailHashLink}">Follow the link</a> to set a new password to log in to viralbear.media`
    );

    res.status(200).json({ message: "Check your mailbox", status: "success" });
  } catch (err) {
    console.log(err);
    return res.status(400).json({
      message: "Server side error",
      status: "error",
    });
  }
};

const recoveryPassword = async (req, res) => {
  const { hash, password } = req.body;

  if (!hash) {
    return res
      .status(200)
      .json({ message: "The link is invalid", status: "warning" });
  }

  try {
    const recoveryData = await RecoveryLinks.findOne({ hash });

    if (!recoveryData) {
      return res
        .status(200)
        .json({ message: "The link is invalid", status: "warning" });
    }

    const timeHasPassedInMinutes = moment(
      moment().diff(moment(recoveryData.createdAt))
    ).minutes();

    if (timeHasPassedInMinutes > 60) {
      await recoveryData.deleteOne({});

      return res
        .status(200)
        .json({ message: "The link is invalid", status: "warning" });
    }

    const worker = await User.findOne({ email: recoveryData.email });

    if (!worker) {
      return res.status(200).json({ message: "No access", status: "warning" });
    }

    if (!!worker.inTheArchive) {
      return res.status(200).json({
        message: "Your account is blocked. Contact the administrator",
        status: "warning",
      });
    }

    const salt = await genSalt(10);

    await worker.updateOne({ password: await hashBcrypt(password, salt) });

    await RecoveryLinks.deleteOne({ hash });

    return res.status(200).json({
      message: "Password has been successfully updated",
      status: "success",
    });
  } catch (err) {
    console.log(err);

    return res.status(400).json({
      message: "Server side error",
      status: "error",
    });
  }
};

const createUser = async (objDB) => {
  return User.create(objDB);
};

const findWorkersForCard = async (workers, selfWorkerName) => {
  return await User.find({
    name: { $in: [...workers, selfWorkerName] },
  });
};

const updateUser = async ({
  userId,
  objDBForUnset,
  objDBForSet,
  objDBForIncrement,
}) => {
  return await User.updateOne(
    {
      _id: userId,
    },
    {
      ...(objDBForSet && { $set: objDBForSet }),
      ...(objDBForUnset && { $unset: objDBForUnset }),
      ...(objDBForIncrement && { $inc: objDBForIncrement }),
    }
  );
};

const updateUserByIncrement = async (field, emailsOfResearchers, objDB) => {
  return await User.updateMany(
    { [field]: { $in: emailsOfResearchers } },
    { $inc: objDB }
  );
};

const updateUsersBy = async ({ updateBy, userList, objDBForSet }) => {
  return await User.updateMany(
    { [updateBy]: { $in: userList } },
    { ...(objDBForSet && objDBForSet) }
  );
};

const findWorkerEmailByWorkerName = async (decodeResearchers) => {
  const workers = await User.find({ role: "researcher" });

  const workersEmailsList = decodeResearchers
    .map((el) => {
      const nameRespond = workers.find((worker) => worker.name === el);
      return nameRespond.email;
    })
    .filter((el) => el);

  return workersEmailsList;
};

const findUsersListByValuesList = async ({
  valuesList,
  role,
  valueForRequest,
  valueForResponse,
}) => {
  const users = await User.find({ ...(!!role && { role }) });

  return valuesList
    .map((value) => {
      const nameRespond = users.find((user) => {
        return user[valueForRequest] === value;
      });

      return nameRespond[valueForResponse];
    })
    .filter((value) => value);
};

const findUsersByValueList = async ({ param, valueList, roles }) => {
  return await User.find({ [param]: { $in: valueList } });
};

const updateUserBy = async ({
  updateBy,
  value,
  objDBForSet,
  objDBForIncrement,
  objDBForUnset,
}) => {
  return await User.updateOne(
    { [updateBy]: value },
    {
      ...(objDBForSet && { $set: objDBForSet }),
      ...(objDBForUnset && { $unset: objDBForUnset }),
      ...(objDBForIncrement && { $inc: objDBForIncrement }),
    }
  );
};

module.exports = {
  getAllUsers,
  deleteUser,
  sendPassword,
  createUser,
  recoveryPassword,
  getUserById,
  getUserByEmail,
  findWorkersForCard,
  updateUser,
  findUsersByEmails,
  updateUserByIncrement,
  getUserBy,
  findWorkerEmailByWorkerName,
  updateUsersBy,
  findUsersByValueList,
  findUsersListByValuesList,
  updateUserBy,
};
