const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

const { generateHash } = require('random-hash');

const authMiddleware = require('../middleware/auth.middleware');

const { getUserById } = require('../controllers/user.controller');

const {
  conversionIncorrectLinks,
  findBaseUrl,
  pullIdFromUrl,
} = require('../controllers/links.controller');

const {
  findAuthorLinkByVideoId,
  deleteAuthorLink,
  createNewAuthorLink,
  findOneByFormId,
} = require('../controllers/authorLink.controller');

router.post('/create', authMiddleware, async (req, res) => {
  const {
    percentage,
    advancePayment,
    videoLink: reqVideoLink,
    confirmDeletion,
  } = req.body;

  if (!reqVideoLink && (!percentage || !advancePayment)) {
    return res.status(400).json({
      message: 'Missing parameters for link generation',
      status: 'warning',
    });
  }

  try {
    const user = await getUserById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        status: 'error',
      });
    }

    const convertedLink = conversionIncorrectLinks(reqVideoLink);

    const videoLink = await findBaseUrl(convertedLink);

    if (!videoLink) {
      return res
        .status(400)
        .json({ message: 'Link is invalid', status: 'error' });
    }

    const videoId = await pullIdFromUrl(videoLink);

    if (!videoId) {
      return res
        .status(400)
        .json({ message: 'Link is invalid', status: 'error' });
    }

    const authorLink = await findAuthorLinkByVideoId(videoId);

    if (authorLink) {
      if (confirmDeletion === false) {
        return res.status(200).json({
          message:
            'A unique form has already been generated for this video. Generate a new one?',
          status: 'await',
        });
      } else {
        await deleteAuthorLink({ videoId });
      }
    }

    const formId = generateHash({ length: 13 });

    const bodyForNewAuthorLink = {
      ...(percentage && { percentage }),
      ...(advancePayment && { advancePayment }),
      worker: {
        nickname: user.nickname,
        email: user.email,
      },
      formId,
      formLink: `${process.env.CLIENT_URI}/submitVideo?unq=${formId}`,
      videoLink,
      videoId,
    };

    const newAuthorLink = await createNewAuthorLink(bodyForNewAuthorLink);

    res.status(200).json({
      message: 'The link was successfully generated',
      status: 'success',
      apiData: newAuthorLink,
    });
  } catch (err) {
    console.log(err);
    return res.status(400).json({
      message: 'Server side error',
      status: 'error',
    });
  }
});

router.get('/findOneByFormId/:formId', async (req, res) => {
  const { formId } = req.params;

  try {
    const authorLinkForm = await findOneByFormId(formId);

    if (!authorLinkForm) {
      return res.status(404).json({
        message: `form with Form id "${formId}" not found in the database`,
        status: 'warning',
        code: 404,
      });
    }

    return res.status(200).json({
      message: `form with Form id ${formId} found in the database`,
      status: 'success',
      apiData: authorLinkForm,
    });
  } catch (err) {
    console.log(err);
    return res.status(400).json({
      message: 'Server side error',
      status: 'error',
    });
  }
});

module.exports = router;
