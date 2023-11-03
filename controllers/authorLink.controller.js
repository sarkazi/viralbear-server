const AuthorLink = require("../entities/AuthorLink");

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
  const authorLink = await AuthorLink.findOne({ [searchBy]: value }).populate({
    path: "researcher",
    select: {
      name: 1,
      email: 1,
      role: 1,
      avatarUrl: 1,
    },
  });

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

const findAllAuthorLinks = async ({ userId, used }) => {
  return AuthorLink.find({
    ...(userId && { researcher: userId }),
    ...(typeof used === "boolean" && { used }),
  });
};

const updateManyAuthorLinks = async ({ searchBy, searchValue, objForSet }) => {
  return AuthorLink.updateMany(
    {
      [searchBy]: searchValue,
    },
    { $set: objForSet }
  );
};

const updateAuthorLinkBy = async ({ updateBy, updateValue, objForSet }) => {
  return AuthorLink.updateOne(
    {
      [updateBy]: updateValue,
    },
    { $set: objForSet }
  );
};

module.exports = {
  findAuthorLinkByVideoId,
  deleteAuthorLink,
  createNewAuthorLink,
  findOneRefFormByParam,
  markRefFormAsUsed,
  findAllAuthorLinks,
  updateManyAuthorLinks,
  updateAuthorLinkBy,
};
