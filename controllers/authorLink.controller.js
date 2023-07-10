const AuthorLink = require('../entities/AuthorLink');

const findAuthorLinkByVideoId = async (videoId) => {
  const authorLink = await AuthorLink.findOne({ videoId });

  return authorLink;
};

const deleteAuthorLink = async (condition) => {
  return await AuthorLink.deleteOne(condition);
};

const createNewAuthorLink = async (body) => {
  const newAuthorLink = await AuthorLink.create(body);
  return newAuthorLink;
};

const findOneRefFormByParam = async ({ searchBy, value }) => {
  const authorLink = await AuthorLink.findOne({ [searchBy]: value });
  return authorLink;
};

const markRefFormAsUsed = async (formId, objDB) => {
  const authorLink = await AuthorLink.updateOne(
    {
      _id: formId,
    },
    {
      $set: objDB,
    }
  );
  return authorLink;
};

module.exports = {
  findAuthorLinkByVideoId,
  deleteAuthorLink,
  createNewAuthorLink,
  findOneRefFormByParam,
  markRefFormAsUsed,
};
