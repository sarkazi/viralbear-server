const User = require('../entities/User');
const RecoveryLinks = require('../entities/RecoveryLinks');
const md5 = require('md5');
const moment = require('moment');
const { genSalt, hash: hashBcrypt } = require('bcryptjs');

const mailTransporter = require('../nodemailer.instance');

const sendEmailPassword = async (email, subjectText, textEmail, htmlText) => {
  await mailTransporter.sendMail({
    from: '"Information" <info@viralbear.media>',
    to: email,
    subject: subjectText,
    text: textEmail,
    html: htmlText,
  });
};

const getWorkers = async (me, userId) => {
  if (me === false) {
    return await User.find({ _id: { $ne: userId }, role: 'worker' });
  } else {
    return await User.find({ role: 'worker' });
  }
};

const getUserById = async (userId) => {
  return await User.findOne({ _id: userId });
};

const getUserByEmail = async (email) => {
  return await User.findOne({ email });
};

const findUsersByEmails = async (emails) => {
  return await User.find(
    {
      email: { $in: emails },
    },
    { name: 1, _id: 0 }
  );
};

const deleteUser = async (userId) => {
  await User.deleteOne({ _id: userId });
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
      return res.status(404).json({ message: 'User is not found' });
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
      `<a href="http://localhost:${process.env.CLIENT_URI}/login?hash=${tailHashLink}">Follow the link</a> to set a new password to log in to viralbear.media`
    );

    res.status(200).json({ message: 'Check your mailbox' });
  } catch (err) {
    console.log(err);
  }
};

const recoveryPassword = async (req, res) => {
  const { hash, password } = req.body;

  if (!hash) {
    return res.status(404).json({ message: 'The link is invalid' });
  }

  try {
    const recoveryData = await RecoveryLinks.findOne({ hash });

    if (!recoveryData) {
      return res.status(404).json({ message: 'The link is invalid' });
    }

    const timeHasPassedInMinutes = moment(
      moment().diff(moment(recoveryData.createdAt))
    ).minutes();

    if (timeHasPassedInMinutes > 60) {
      await recoveryData.deleteOne({});

      return res.status(404).json({ message: 'The link is invalid' });
    }

    const worker = await User.findOne({ email: recoveryData.email });

    if (!worker) {
      return res.status(404).json({ message: 'No access' });
    }

    const salt = await genSalt(10);

    await worker.updateOne({ password: await hashBcrypt(password, salt) });

    await RecoveryLinks.deleteOne({ hash });

    res.status(200).json({ message: 'Password has been successfully updated' });
  } catch (err) {
    console.log(err);
  }
};

const createUser = async (objDB) => {
  return User.create(objDB);
};

const findWorkersForCard = async (workers, selfWorker) => {
  return await User.find({
    name: { $in: [...workers, selfWorker.name] },
  });
};

const updateUser = async (userId, objDB) => {
  return await User.updateOne(
    {
      _id: userId,
    },
    {
      $set: objDB,
    }
  );
};

const updateUserByIncrement = async (field, emailsOfResearchers, objDB) => {
  return await User.updateMany(
    { [field]: { $in: emailsOfResearchers } },
    { $inc: objDB }
  );
};

module.exports = {
  getWorkers,
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
};
