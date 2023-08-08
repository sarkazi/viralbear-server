const removeValuesWithoutKeyFieldInPairedReport = ({
  parseReport,
  companyName,
}) => {
  if (companyName === 'newsFlare') {
    return parseReport.filter((obj) => {
      return obj.hasOwnProperty('Partner Video Id');
    });
  } else if (companyName === 'videoElephant') {
    return parseReport.filter((obj) => {
      return obj.hasOwnProperty('Content Provider Revenue');
    });
  } else if (companyName === 'aflo') {
    return parseReport.filter((obj) => {
      return obj.hasOwnProperty('Aflo Ref:');
    });
  } else if (companyName === 'tmb') {
    return parseReport.filter((obj) => {
      return obj.hasOwnProperty('Amount');
    });
  } else if (companyName === 'kameraOne') {
    return parseReport.filter((obj) => {
      return obj.hasOwnProperty('Video_ref_ID');
    });
  } else if (companyName === 'stringersHub') {
    return parseReport.filter((obj) => {
      return obj.hasOwnProperty('ViralBear ID');
    });
  }
};

module.exports = removeValuesWithoutKeyFieldInPairedReport;
