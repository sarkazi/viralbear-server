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
  findLinkBy,
} = require('../controllers/links.controller');

const {
  findAuthorLinkByVideoId,
  deleteAuthorLink,
  createNewAuthorLink,
  findOneRefFormByParam,
} = require('../controllers/authorLink.controller');

router.post('/create', authMiddleware, async (req, res) => {
  const {
    percentage,
    advancePayment,
    videoLink: reqVideoLink,
    confirmDeletion,
    confirmIncorrect,
    exclusivity,
  } = req.body;



  if (!reqVideoLink && (!percentage || !advancePayment)) {
    return res.status(200).json({
      message: 'Missing parameters for link generation',
      status: 'warning',
    });
  }

  if (!exclusivity && !advancePayment && !percentage) {
    return res.status(200).json({
      message: 'The percent/advance cannot be empty in this case',
      status: 'warning',
    });
  }

  try {
    const user = await getUserById(req.user.id);

    if (!user) {
      return res.status(200).json({
        message: 'User not found',
        status: 'warning',
      });
    }

    const convertedLink = conversionIncorrectLinks(reqVideoLink);

    //const videoLink = await findBaseUrl(convertedLink);

    //if (!videoLink) {
    //  return res
    //    .status(200)
    //    .json({ message: 'Link is invalid', status: 'warning' });
    //}

    const videoId = await pullIdFromUrl(convertedLink);

    if (!videoId) {
      return res
        .status(200)
        .json({ message: 'Link is invalid', status: 'warning' });
    }

    const link = await findLinkBy({ searchBy: 'unixid', value: videoId });

    if (!link) {
      if (!confirmIncorrect) {
        return res.status(200).json({
          message:
            'There is no Trello card for this video. Are you sure that this link is correct?',
          status: 'await',
          type: 'incorrect',
        });
      }
    }

    const authorLink = await findAuthorLinkByVideoId(videoId);

    if (authorLink) {
      if (!confirmDeletion) {
        return res.status(200).json({
          message:
            'A unique form has already been generated for this video. Generate a new one?',
          status: 'await',
          type: 'repeat',
        });
      } else {
        await deleteAuthorLink({ videoId });
      }
    }

    const formHash = generateHash({ length: 13 });

    const bodyForNewAuthorLink = {
      percentage: percentage ? percentage : 0,
      advancePayment: advancePayment ? advancePayment : 0,
      researcher: user._id,
      formHash,
      formLink: `${process.env.CLIENT_URI}/submitVideo?unq=${formHash}`,
      videoLink: convertedLink,
      videoId,
      exclusivity,
      ...(link?.trelloCardUrl && { trelloCardUrl: link.trelloCardUrl }),
    };

    const newAuthorLink = await createNewAuthorLink(bodyForNewAuthorLink);

    res.status(200).json({
      message: 'The link was successfully generated',
      status: 'success',
      apiData: newAuthorLink,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: 'Server side error',
      status: 'error',
    });
  }
});

router.get('/findOne/:value', async (req, res) => {
  const { value } = req.params;
  const { searchBy } = req.query;

  if (!value || !searchBy) {
    return res.status(200).json({
      message: `Missing parameters for form search`,
      status: 'warning',
    });
  }

  try {
    const authorLinkForm = await findOneRefFormByParam({ searchBy, value });

    if (!authorLinkForm) {
      return res.status(200).json({
        message: `Form not found in the database`,
        status: 'warning',
        code: 404,
      });
    }

    return res.status(200).json({
      message: `The referral form data is obtained from the database`,
      status: 'success',
      apiData: authorLinkForm,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: 'Server side error',
      status: 'error',
    });
  }
});

module.exports = router;
