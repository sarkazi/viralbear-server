const definitionThePartnerCompanyByFileHeader = ({ fileHeaderValues }) => {
  if (
    fileHeaderValues.find((headerValue) => headerValue === 'Partner Video Id')
  ) {
    return 'newsFlare';
  } else if (
    fileHeaderValues.find(
      (headerValue) => headerValue === 'Content Provider Revenue'
    )
  ) {
    return 'videoElephant';
  } else if (
    fileHeaderValues.find((headerValue) => headerValue === 'Aflo Ref:')
  ) {
    return 'aflo';
  } else if (fileHeaderValues.find((headerValue) => headerValue === 'Amount')) {
    return 'tmb';
  } else if (
    fileHeaderValues.find((headerValue) => headerValue === 'Video_ref_ID')
  ) {
    return 'kameraOne';
  } else if (
    fileHeaderValues.find((headerValue) => headerValue === 'ViralBear ID')
  ) {
    return 'stringersHub';
  } else {
    return null;
  }
};

module.exports = definitionThePartnerCompanyByFileHeader;
