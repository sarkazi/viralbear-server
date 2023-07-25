const calcVbCode = (prevLine) => {
  if (!prevLine) {
    return 1;
  } else {
    return +prevLine.formId.split('B')[1] + 1;
  }
};

module.exports = calcVbCode;
