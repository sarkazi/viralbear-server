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

const findOneByFormId = async (formId) => {
  const authorLink = await AuthorLink.findOne({ formId });
  return authorLink;
};

const markAsUsed = async (formId, objDB) => {
  const authorLink = await AuthorLink.updateOne(
    {
      formId,
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
  findOneByFormId,
  markAsUsed,
};
