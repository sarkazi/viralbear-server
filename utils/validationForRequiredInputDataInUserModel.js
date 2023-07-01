const validationForRequiredInputDataInUserModel = (role, data, method) => {
  if (!role) {
    return false;
  }
  if (role === 'worker') {
    if (
      !data.email ||
      !data.name ||
      !data.password ||
      !data.nickname ||
      //!data.percentage ||
      //!data.amountPerVideo ||
      //!data.country ||
      !data.role ||
      //!data.paymentInfo.variant ||
      //!data.paymentInfo.value ||
      typeof data.canBeAssigned !== 'boolean'
    ) {
      return false;
    } else {
      return true;
    }
  }
  if (role === 'admin') {
    if (
      !data.email ||
      !data.name ||
      !data.password ||
      !data.nickname ||
      !data.role
    ) {
      return false;
    } else {
      return true;
    }
  }
  if (role === 'editor') {
    if (
      !data.email ||
      !data.name ||
      !data.password ||
      !data.nickname ||
      !data.role
    ) {
      return false;
    } else {
      return true;
    }
  }
  if (role === 'stringer') {
    if (
      !data.email ||
      !data.name ||
      !data.password ||
      //!data.amountPerVideo ||
      !data.role ||
      //!data.paymentInfo.variant ||
      //!data.paymentInfo.value ||
      typeof data.canBeAssigned !== 'boolean'
    ) {
      return false;
    } else {
      return true;
    }
  }
  if (role === 'author') {
    if (method === 'update') {
      if (
        !data.paymentInfo.variant ||
        (data.paymentInfo.variant === 'bankTransfer' &&
          (!data.paymentInfo.email ||
            !data.paymentInfo.fullName ||
            !data.paymentInfo.address ||
            !data.paymentInfo.phoneNumber ||
            !data.paymentInfo.zipCode ||
            !data.paymentInfo.bankName ||
            !data.paymentInfo.iban)) ||
        (data.paymentInfo.variant === 'payPal' &&
          !data.paymentInfo.payPalEmail) ||
        (data.paymentInfo.variant === 'other' && !data.paymentInfo.value)
      ) {
        return false;
      } else {
        return true;
      }
    } else {
      if (
        !data.email ||
        !data.name ||
        !data.password ||
        //!data.amountPerVideo ||
        !data.role
        //!data.paymentInfo.variant ||
        //(data.paymentInfo.variant === 'bankTransfer' &&
        //  (!data.paymentInfo.email ||
        //    !data.paymentInfo.fullName ||
        //    !data.paymentInfo.address ||
        //    !data.paymentInfo.phoneNumber ||
        //    !data.paymentInfo.zipCode ||
        //    !data.paymentInfo.bankName ||
        //    !data.paymentInfo.iban)) ||
        //(data.paymentInfo.variant === 'payPal' &&
        //  !data.paymentInfo.payPalEmail) ||
        //(data.paymentInfo.variant === 'other' && !data.paymentInfo.value)
      ) {
        return false;
      } else {
        return true;
      }
    }
  }
};

module.exports = validationForRequiredInputDataInUserModel;
