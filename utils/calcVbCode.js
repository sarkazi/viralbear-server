const utilIncFormId = (int) => {
  if (int < 9) {
    const lastEl = Number(int.slice(-1));
    return `00${lastEl + 1}`;
  }
  if (int >= 9 && int < 99) {
    const lastEl = Number(int.slice(-2));
    return `0${lastEl + 1}`;
  }
  if (int >= 99) {
    const tranformInt = Number(int);

    return `${tranformInt + 1}`;
  }
};

const calcOfIncrement = (prevLine) => {
  if (!prevLine) {
    return '001';
  } else {
    const prevFormId = prevLine?.formId?.split('B')[1];
    return utilIncFormId(prevFormId);
  }
};

module.exports = calcOfIncrement;
