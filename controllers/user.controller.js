const User = require('../entities/User');
const RecoveryLinks = require('../entities/RecoveryLinks');
const md5 = require('md5');
const moment = require('moment');
const { genSalt, hash: hashBcrypt } = require('bcryptjs');

const mailTransporter = require('../nodemailer.instance');

const { getSalesByUserEmail } = require('../controllers/sales.controller');

const { getCountLinksByUserEmail } = require('../controllers/links.controller');

const {
  getCountApprovedTrelloCardByNickname,
} = require('../controllers/moveFromReview.controller');

const {
  getCountAcquiredVideoByUserEmail,
} = require('../controllers/video.controller');

const sendEmailPassword = async (email, subjectText, textEmail, htmlText) => {
  await mailTransporter.sendMail({
    from: '"Information" <info@viralbear.media>',
    to: email,
    subject: subjectText,
    text: textEmail,
    html: htmlText,
  });
};

const getAllUsers = async (me, userId, role) => {
  return await User.find({
    ...(me === false && { _id: { $ne: userId } }),
    ...(role && { role }),
  });

  //if (me === false) {
  //  return await User.find({ _id: { $ne: userId }, ...(role)role: 'worker' });
  //} else {
  //  return await User.find({ role: 'worker' });
  //}
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

const updateUser = async (userId, objDB, objDBForIncrement) => {
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

const updateStatForUsers = async (role) => {
  const users = await getAllUsers(true, null, role);

  await Promise.all(
    users.map(async (user) => {
      const salesDateLimit = await getSalesByUserEmail(user.email, 30);

      const salesSumAmountDateLimit = salesDateLimit.reduce((acc, sale) => {
        return +(
          acc +
          sale.amountToResearcher / sale.researchers.emails.length
        ).toFixed(2);
      }, 0);

      const sales = await getSalesByUserEmail(user.email, null);

      const earnedForYourself = sales.reduce(
        (a, sale) =>
          a + +(sale.amountToResearcher / sale?.researchers?.emails?.length),
        0
      );
      const earnedTotal = sales.reduce(
        (a, sale) => a + +(sale.amount / sale?.researchers?.emails?.length),
        0
      );

      const earnedForCompany = sales.reduce(
        (a, sale) =>
          a +
          +(
            sale.amount / sale?.researchers?.emails?.length -
            sale.amountToResearcher / sale?.researchers?.emails?.length
          ),
        0
      );

      if (user.name === 'ViralBear') {
        console.log(earnedTotal, earnedForCompany, 898);
      }

      let earnedTillNextPayment = earnedForYourself - user.balance;

      const linksCountDateLimit = await getCountLinksByUserEmail(
        user.email,
        30
      );

      const linksCount = await getCountLinksByUserEmail(user.email, null);

      const acquiredVideoCountDateLimit =
        await getCountAcquiredVideoByUserEmail(user.email, 30);

      const acquiredVideoCount = await getCountAcquiredVideoByUserEmail(
        user.email,
        null
      );

      const approvedTrelloCardCountDateLimit =
        await getCountApprovedTrelloCardByNickname(user.nickname, 30);

      const approvedTrelloCardCount =
        await getCountApprovedTrelloCardByNickname(user.nickname, null);

      const defineDefaultValueForPayingInput = async () => {
        if (role === 'worker') {
          if (user.lastPaymentDate) {
            const daysSinceLastPayment = Math.abs(
              Math.ceil(
                (moment().valueOf() - moment(user.lastPaymentDate).valueOf()) /
                  1000 /
                  60 /
                  60 /
                  24
              )
            );

            const acquiredVideoCountDateLimit =
              await getCountAcquiredVideoByUserEmail(
                user.email,
                daysSinceLastPayment + 1
              );

            const earnedAfterLastPayment =
              user.amountPerVideo * acquiredVideoCountDateLimit;

            const defaultInputValue =
              earnedTillNextPayment > earnedAfterLastPayment ||
              role === 'stringer'
                ? earnedAfterLastPayment
                : earnedTillNextPayment;

            return defaultInputValue;
          }
        }
      };

      const defaultInputValue = await defineDefaultValueForPayingInput();

      const dataDBForUpdateUser = {
        'sentVideosCount.dateLimit': linksCountDateLimit,
        'sentVideosCount.total': linksCount,
        'earnedForYourself.dateLimit': +salesSumAmountDateLimit.toFixed(2),
        'earnedForYourself.total': +earnedForYourself.toFixed(2),
        earnedTotal: +earnedTotal.toFixed(2),
        earnedForCompany: +earnedForCompany.toFixed(2),
        'acquiredVideosCount.dateLimit': acquiredVideoCountDateLimit,
        'acquiredVideosCount.total': acquiredVideoCount,
        'approvedVideosCount.dateLimit': approvedTrelloCardCountDateLimit,
        'approvedVideosCount.total': approvedTrelloCardCount,
        earnedTillNextPayment:
          role === 'worker'
            ? +earnedTillNextPayment.toFixed(2)
            : defaultInputValue
            ? defaultInputValue
            : 0,
        defaultPaymentAmount: defaultInputValue
          ? +defaultInputValue.toFixed(2)
          : 0,
      };

      await updateUser(user._id, dataDBForUpdateUser, {});
    })
  );

  const allUsersWithRefreshStat = await getAllUsers(true, null, role);

  const sumCountUsersValue = allUsersWithRefreshStat.reduce(
    (acc = {}, user = {}) => {
      //суммарный баланс работников
      acc.balance = parseFloat((acc.balance + user.balance).toFixed(2));

      //суммарный earnedTillNextPayment работников
      acc.earnedTillNextPayment =
        role === 'worker'
          ? parseFloat(
              (
                acc.earnedTillNextPayment +
                (user.earnedForYourself.total - user.balance)
              ).toFixed(2)
            )
          : parseFloat(
              (acc.earnedTillNextPayment + user.earnedTillNextPayment).toFixed(
                2
              )
            );

      //суммарный личный заработок работников
      acc.earnedForYourself = {
        //за 30 дней
        dateLimit: parseFloat(
          (
            acc.earnedForYourself.dateLimit + user.earnedForYourself.dateLimit
          ).toFixed(2)
        ),
        //всего
        total: parseFloat(
          (acc.earnedForYourself.total + user.earnedForYourself.total).toFixed(
            2
          )
        ),
      };

      //суммарный общий заработок работников
      acc.earnedTotal = parseFloat(
        (acc.earnedTotal + user.earnedTotal).toFixed(2)
      );
      //суммарный заработок компании
      acc.earnedForCompany = parseFloat(
        (acc.earnedForCompany + user.earnedForCompany).toFixed(2)
      );

      //суммарное количество отправленных работниками в трелло видео
      acc.sentVideosCount = {
        //за 30 дней
        dateLimit: parseFloat(
          (
            acc.sentVideosCount.dateLimit + user.sentVideosCount.dateLimit
          ).toFixed(2)
        ),
        //общий
        total: parseFloat(
          (acc.sentVideosCount.total + user.sentVideosCount.total).toFixed(2)
        ),
      };

      //суммарное количество опубликованных на сайте видео, где присутствуют работники
      acc.acquiredVideosCount = {
        //за 30 дней
        dateLimit: parseFloat(
          (
            acc.acquiredVideosCount.dateLimit +
            user.acquiredVideosCount.dateLimit
          ).toFixed(2)
        ),
        //общий
        total: parseFloat(
          (
            acc.acquiredVideosCount.total + user.acquiredVideosCount.total
          ).toFixed(2)
        ),
      };

      //суммарное количество одобренных видео (перемещенные из review листа в trello), где присутствуют работники
      acc.approvedVideosCount = {
        //за 30 дней
        dateLimit: parseFloat(
          (
            acc.approvedVideosCount.dateLimit +
            user.approvedVideosCount.dateLimit
          ).toFixed(2)
        ),
        //общий
        total: parseFloat(
          (
            acc.approvedVideosCount.total + user.approvedVideosCount.total
          ).toFixed(2)
        ),
      };

      return acc;
    },
    {
      balance: 0,
      earnedTillNextPayment: 0,
      earnedForYourself: {
        dateLimit: 0,
        total: 0,
      },
      earnedTotal: 0,
      earnedForCompany: 0,
      sentVideosCount: {
        dateLimit: 0,
        total: 0,
      },
      acquiredVideosCount: {
        dateLimit: 0,
        total: 0,
      },
      approvedVideosCount: {
        dateLimit: 0,
        total: 0,
      },
    }
  );

  return {
    allUsersWithRefreshStat,
    sumCountUsersValue,
    status: 'success',
  };
};

const updateUserByIncrement = async (field, emailsOfResearchers, objDB) => {
  return await User.updateMany(
    { [field]: { $in: emailsOfResearchers } },
    { $inc: objDB }
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
  updateStatForUsers,
};
