const UploadInfo = require("../entities/UploadInfo");

const findOne = async (objDB) => {
  const { searchBy, param } = objDB;

  return await UploadInfo.findOne({
    [searchBy]: param,
  })
    .populate({
      path: "refFormId",
      populate: {
        path: "researcher",
        select: { email: 1, name: 1 },
      },
      select: {
        percentage: 1,
        advancePayment: 1,
        exclusivity: 1,
        trelloCardUrl: 1,
        trelloCardId: 1,
        videoId: 1,
        paid: 1,
        videoLink: 1,
      },
    })
    .populate({
      path: "sender",
      select: {
        email: 1,
        name: 1,
        paymentInfo: 1,
        activatedTheAccount: 1,
      },
    });
};

const findLastAddedVbForm = async () => {
  const lastAddedVbForm = await UploadInfo.findOne({})
    .sort({ createdAt: -1 })
    .limit(1)
    .select({ formId: true });

  return lastAddedVbForm;
};

const createNewVbForm = async (objDB) => {
  return await UploadInfo.create(objDB);
};

const updateVbFormByFormId = async (formId, objDB) => {
  return await UploadInfo.updateOne(
    {
      formId,
    },
    {
      $set: objDB,
    }
  );
};

const deleteVbFormBy = async ({ deleteBy, value }) => {
  return await UploadInfo.deleteOne({
    [deleteBy]: value,
  });
};

const deleteVbFormsBy = async ({ deleteBy, value }) => {
  return await UploadInfo.deleteMany({
    [deleteBy]: value,
  });
};

const updateVbFormBy = async ({ updateBy, value, dataForUpdate }) => {
  return await UploadInfo.updateOne(
    {
      [updateBy]: value,
    },
    {
      $set: dataForUpdate,
    }
  );
};

const findAllVbForms = async ({ refFormId }) => {
  return await UploadInfo.find({
    ...(!!refFormId && { refFormId }),
  });
};

module.exports = {
  findOne,
  findLastAddedVbForm,
  createNewVbForm,
  updateVbFormByFormId,
  updateVbFormBy,
  deleteVbFormBy,
  findAllVbForms,
  deleteVbFormsBy,
};
