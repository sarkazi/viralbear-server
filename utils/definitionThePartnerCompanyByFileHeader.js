const definitionThePartnerCompanyByFileHeader = ({ fileHeaderValues }) => {
  if (
    fileHeaderValues.find((headerValue) => headerValue === 'Partner Video Id')
  ) {
    return 'newsflare';
  } else if (
    fileHeaderValues.find(
      (headerValue) => headerValue === 'Content Provider Revenue'
    )
  ) {
    return 'videoelephant';
  } else if (
    fileHeaderValues.find((headerValue) => headerValue === 'Aflo Ref:')
  ) {
    return 'aflo';
  } else if (fileHeaderValues.find((headerValue) => headerValue === 'Amount')) {
    return 'tmb';
  } else if (
    fileHeaderValues.find((headerValue) => headerValue === 'Video_ref_ID')
  ) {
    return 'kameraone';
  } else if (
    fileHeaderValues.find((headerValue) => headerValue === 'ViralBear ID')
  ) {
    return 'stringershub';
  } else {
    return null;
  }
};

module.exports = definitionThePartnerCompanyByFileHeader;
