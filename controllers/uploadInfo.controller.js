const UploadInfo = require('../entities/UploadInfo');
const { renderToFile } = require('@react-pdf/renderer');

const findOne = async (objDB) => {
  const { searchBy, param } = objDB;

  return await UploadInfo.findOne({
    [searchBy]: param,
  })
    .populate({
      path: 'refFormId',
      populate: {
        path: 'researcher',
        select: { email: 1, name: 1 },
      },
      select: {
        percentage: 1,
        advancePayment: 1,
        exclusivity: 1,
        trelloCardUrl: 1,
      },
    })
    .populate({
      path: 'sender',
      select: {
        email: 1,
        name: 1,
        paymentInfo: 1,
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

module.exports = {
  findOne,
  findLastAddedVbForm,
  createNewVbForm,
  updateVbFormByFormId,
  updateVbFormBy,
};
