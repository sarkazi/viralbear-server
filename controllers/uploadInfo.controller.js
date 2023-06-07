const UploadInfo = require('../entities/UploadInfo');
const { renderToFile } = require('@react-pdf/renderer');

const findOne = async (formId) => {
  return await UploadInfo.findOne({
    formId: `VB${formId}`,
  });
};

const findLastAddedVbForm = async () => {
  const lastAddedVbForm = await UploadInfo.findOne({})
    .sort({ submittedDate: -1 })
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

module.exports = {
  findOne,
  findLastAddedVbForm,
  createNewVbForm,
  updateVbFormByFormId,
};
