const User = require('../entities/User');
const RecoveryLinks = require('../entities/RecoveryLinks');
const md5 = require('md5');
const moment = require('moment');
const { genSalt, hash: hashBcrypt } = require('bcryptjs');

const mailTransporter = require('../nodemailer.instance');

const { getSalesByUserId } = require('../controllers/sales.controller');

const { getCountLinksByUserEmail } = require('../controllers/links.controller');

const { getCountAcquiredVideosBy } = require('../controllers/video.controller');

const {
  getCountApprovedTrelloCardBy,
} = require('../controllers/movedToDoneList.controller');

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
}) => {
  return await User.find(
    {
      ...(me === false && { _id: { $ne: userId } }),
      ...(roles && roles.length && { role: { $in: roles } }),
      ...((canBeAssigned === true || canBeAssigned === false) && {
        canBeAssigned,
      }),
    },
    {
      ...(fieldsInTheResponse &&
        fieldsInTheResponse.reduce((a, v) => ({ ...a, [v]: 1 }), {})),
    }
  );
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
    }
    //{ name: 1, _id: 0 }
  );
};

const deleteUser = async (userId) => {
  await User.deleteOne({ _id: userId });
};

const getUserBy = async ({ param, value, fieldsInTheResponse }) => {
  return await User.findOne(
    { [param]: value },
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

const findWorkersForCard = async (workers, selfWorkerName) => {
  return await User.find({
    name: { $in: [...workers, selfWorkerName] },
  });
};

const updateUser = async ({ userId, objDB, objDBForIncrement }) => {
  return await User.updateOne(
    {
      _id: userId,
    },
    {
      ...(Object.keys(objDB).length && { $set: objDB }),
      ...(Object.keys(objDBForIncrement).length && { $inc: objDBForIncrement }),
    }
  );
};

const updateStatForUsers = async ({ roles }) => {
  //const users = await getAllUsers({
  //  me: true,
  //  userId: null,
  //  roles,
  //});
  //const employeeStat = await Promise.all(
  //  users.map(async (user) => {
  //    //-----------------------------------------------------------------------------------------------------
  //    const salesLast30Days = await getSalesByUserId(user._id, 30);
  //    const salesTotal = await getSalesByUserId(user._id, null);
  //    const earnedYourselfLast30Days = salesLast30Days.reduce((acc, sale) => {
  //      return +(acc + sale.amountToResearcher).toFixed(2);
  //    }, 0);
  //    const earnedYourselfTotal = salesTotal.reduce(
  //      (a, sale) => a + +sale.amountToResearcher,
  //      0
  //    );
  //    const earnedTotal = salesTotal.reduce(
  //      (a, sale) => a + +(sale.amount / sale.researchers.length),
  //      0
  //    );
  //    const earnedCompanies = salesTotal.reduce(
  //      (a, sale) => a + ((sale.amount / sale.researchers.length) * 60) / 100,
  //      0
  //    );
  //    let earnedTillNextPayment = earnedYourselfTotal - user.balance;
  //    const linksCountLast30Days = await getCountLinksByUserEmail(
  //      user.email,
  //      30
  //    );
  //    const linksCountLast7Days = await getCountLinksByUserEmail(user.email, 7);
  //    const linksCount = await getCountLinksByUserEmail(user.email, null);
  //    const acquiredVideosCountLast30DaysMainRole =
  //      await getCountAcquiredVideosBy({
  //        searchBy: 'trelloData.researchers',
  //        value: user.email,
  //        forLastDays: 30,
  //        purchased: true,
  //      });
  //    const acquiredVideosCountLast30DaysNoMainRole =
  //      await getCountAcquiredVideosBy({
  //        searchBy: 'trelloData.researchers',
  //        value: user.email,
  //        forLastDays: 30,
  //        purchased: false,
  //      });
  //    const acquiredVideosCountLast7DaysMainRole =
  //      await getCountAcquiredVideosBy({
  //        searchBy: 'trelloData.researchers',
  //        value: user.email,
  //        forLastDays: 7,
  //        purchased: true,
  //      });
  //    const acquiredVideosCountLast7DaysNoMainRole =
  //      await getCountAcquiredVideosBy({
  //        searchBy: 'trelloData.researchers',
  //        value: user.email,
  //        forLastDays: 7,
  //        purchased: false,
  //      });
  //    const acquiredVideosCountMainRole = await getCountAcquiredVideosBy({
  //      searchBy: 'trelloData.researchers',
  //      value: user.email,
  //      forLastDays: null,
  //      purchased: true,
  //    });
  //    const acquiredVideosCountNoMainRole = await getCountAcquiredVideosBy({
  //      searchBy: 'trelloData.researchers',
  //      value: user.email,
  //      forLastDays: null,
  //      purchased: false,
  //    });
  //    const approvedVideosCountLast30Days = await getCountApprovedTrelloCardBy({
  //      searchBy: 'researcherId',
  //      value: user._id,
  //      forLastDays: 30,
  //    });
  //    const approvedVideosCountLast7Days = await getCountApprovedTrelloCardBy({
  //      searchBy: 'researcherId',
  //      value: user._id,
  //      forLastDays: 7,
  //    });
  //    const approvedVideosCount = await getCountApprovedTrelloCardBy({
  //      searchBy: 'researcherId',
  //      value: user._id,
  //      forLastDays: null,
  //    });
  //    //-----------------------------------------------------------------------------------------------------
  //    const videoWithAnUnpaidAdvance = await
  //    //const defineDefaultValueForPayingInput = async () => {
  //    //  if (roles[0] === 'researcher') {
  //    //    if (user.lastPaymentDate) {
  //    //      const daysSinceLastPayment = Math.abs(
  //    //        Math.ceil(
  //    //          (moment().valueOf() - moment(user.lastPaymentDate).valueOf()) /
  //    //            1000 /
  //    //            60 /
  //    //            60 /
  //    //            24
  //    //        )
  //    //      );
  //    //      const acquiredVideosCountLast30Days =
  //    //        await getCountAcquiredVideosBy({
  //    //          searchBy: 'trelloData.researchers',
  //    //          value: user.email,
  //    //          forLastDays: daysSinceLastPayment + 1,
  //    //          main: false,
  //    //        });
  //    //      const earnedAfterLastPayment =
  //    //        user.advancePayment * acquiredVideosCountLast30Days;
  //    //      const defaultInputValue =
  //    //        earnedTillNextPayment > earnedAfterLastPayment ||
  //    //        roles[0] === 'stringer'
  //    //          ? earnedAfterLastPayment
  //    //          : earnedTillNextPayment;
  //    //      return defaultInputValue;
  //    //    }
  //    //  }
  //    //};
  //    //const defaultPaymentAmount = await defineDefaultValueForPayingInput();
  //    return {
  //      ...user._doc,
  //      sentVideosCount: {
  //        total: linksCount,
  //        last30Days: linksCountLast30Days,
  //        last7Days: linksCountLast7Days,
  //      },
  //      acquiredVideosCount: {
  //        noMainRole: {
  //          total: acquiredVideosCountNoMainRole,
  //          last30Days: acquiredVideosCountLast30DaysNoMainRole,
  //          last7Days: acquiredVideosCountLast7DaysNoMainRole,
  //        },
  //        mainRole: {
  //          total: acquiredVideosCountMainRole,
  //          last30Days: acquiredVideosCountLast30DaysMainRole,
  //          last7Days: acquiredVideosCountLast7DaysMainRole,
  //        },
  //      },
  //      approvedVideosCount: {
  //        total: approvedVideosCount,
  //        last30Days: approvedVideosCountLast30Days,
  //        last7Days: approvedVideosCountLast7Days,
  //      },
  //      earnedYourself: {
  //        total: earnedYourselfTotal,
  //        last30Days: earnedYourselfLast30Days,
  //      },
  //      earnedCompanies,
  //      earnedTotal,
  //      earnedTillNextPayment,
  //      defaultPaymentAmount,
  //    };
  //  })
  //);
  //const totalSumOfStatFields = employeeStat.reduce(
  //  (acc = {}, user = {}) => {
  //    //суммарный баланс работников
  //    acc.balance = parseFloat((acc.balance + user.balance).toFixed(2));
  //    //суммарный earnedTillNextPayment работников
  //    acc.earnedTillNextPayment =
  //      roles[0] === 'researcher'
  //        ? parseFloat(
  //            (
  //              acc.earnedTillNextPayment +
  //              (user.earnedYourself.total - user.balance)
  //            ).toFixed(2)
  //          )
  //        : parseFloat(
  //            (acc.earnedTillNextPayment + user.earnedTillNextPayment).toFixed(
  //              2
  //            )
  //          );
  //    //суммарный личный заработок работников
  //    acc.earnedYourself = {
  //      //за 30 дней
  //      last30Days: parseFloat(
  //        (
  //          acc.earnedYourself.last30Days + user.earnedYourself.last30Days
  //        ).toFixed(2)
  //      ),
  //      //всего
  //      total: parseFloat(
  //        (acc.earnedYourself.total + user.earnedYourself.total).toFixed(2)
  //      ),
  //    };
  //    //суммарный общий заработок работников
  //    acc.earnedTotal = parseFloat(
  //      (acc.earnedTotal + user.earnedTotal).toFixed(2)
  //    );
  //    //суммарный заработок компании
  //    acc.earnedCompanies = parseFloat(
  //      (acc.earnedCompanies + user.earnedCompanies).toFixed(2)
  //    );
  //    //суммарное количество отправленных работниками в трелло видео
  //    acc.sentVideosCount = {
  //      //общий
  //      total: parseFloat(
  //        (acc.sentVideosCount.total + user.sentVideosCount.total).toFixed(2)
  //      ),
  //      //за 30 дней
  //      last30Days: parseFloat(
  //        (
  //          acc.sentVideosCount.last30Days + user.sentVideosCount.last30Days
  //        ).toFixed(2)
  //      ),
  //      // за 7 дней
  //      last7Days: parseFloat(
  //        (
  //          acc.sentVideosCount.last7Days + user.sentVideosCount.last7Days
  //        ).toFixed(2)
  //      ),
  //    };
  //    //суммарное количество опубликованных на сайте видео, где присутствуют работники
  //    acc.acquiredVideosCount = {
  //      //общий
  //      total: parseFloat(
  //        (
  //          acc.acquiredVideosCount.total +
  //          user.acquiredVideosCount.noMainRole.total +
  //          user.acquiredVideosCount.mainRole.total
  //        ).toFixed(2)
  //      ),
  //      //за 30 дней
  //      last30Days: parseFloat(
  //        (
  //          acc.acquiredVideosCount.last30Days +
  //          user.acquiredVideosCount.noMainRole.last30Days +
  //          user.acquiredVideosCount.mainRole.last30Days
  //        ).toFixed(2)
  //      ),
  //      // за 7 дней
  //      last7Days: parseFloat(
  //        (
  //          acc.acquiredVideosCount.last7Days +
  //          user.acquiredVideosCount.noMainRole.last7Days +
  //          user.acquiredVideosCount.mainRole.last7Days
  //        ).toFixed(2)
  //      ),
  //    };
  //    //суммарное количество одобренных видео (перемещенные из review листа в trello), где присутствуют работники
  //    acc.approvedVideosCount = {
  //      //общий
  //      total: parseFloat(
  //        (
  //          acc.approvedVideosCount.total + user.approvedVideosCount.total
  //        ).toFixed(2)
  //      ),
  //      //за 30 дней
  //      last30Days: parseFloat(
  //        (
  //          acc.approvedVideosCount.last30Days +
  //          user.approvedVideosCount.last30Days
  //        ).toFixed(2)
  //      ),
  //      //за 7 дней
  //      last7Days: parseFloat(
  //        (
  //          acc.approvedVideosCount.last7Days +
  //          user.approvedVideosCount.last7Days
  //        ).toFixed(2)
  //      ),
  //    };
  //    return acc;
  //  },
  //  {
  //    balance: 0,
  //    earnedTillNextPayment: 0,
  //    earnedYourself: {
  //      last30Days: 0,
  //      total: 0,
  //    },
  //    earnedTotal: 0,
  //    earnedCompanies: 0,
  //    sentVideosCount: {
  //      total: 0,
  //      last30Days: 0,
  //      last7Days: 0,
  //    },
  //    acquiredVideosCount: {
  //      total: 0,
  //      last30Days: 0,
  //      last7Days: 0,
  //    },
  //    approvedVideosCount: {
  //      total: 0,
  //      last30Days: 0,
  //      last7Days: 0,
  //    },
  //  }
  //);
  //return {
  //  employeeStat,
  //  totalSumOfStatFields,
  //  status: 'success',
  //};
};

const updateUserByIncrement = async (field, emailsOfResearchers, objDB) => {
  return await User.updateMany(
    { [field]: { $in: emailsOfResearchers } },
    { $inc: objDB }
  );
};

const findWorkerEmailByWorkerName = async (decodeResearchers) => {
  const workers = await User.find({ role: 'researcher' });

  const workersEmailsList = decodeResearchers
    .map((el) => {
      const nameRespond = workers.find((worker) => worker.name === el);
      return nameRespond.email;
    })
    .filter((el) => el);

  return workersEmailsList;
};

const findUsersByValueList = async ({ param, valueList }) => {
  return await User.find({ [param]: { $in: valueList } });
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
  updateStatForUsers,
  getUserBy,
  findWorkerEmailByWorkerName,
  findUsersByValueList,
};
