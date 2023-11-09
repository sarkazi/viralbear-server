const mailTransporter = require("../nodemailer.instance");

const sendMainInfoByVBToServiceMail = (dataForSendingMessage) => {
  const { vbForm, accountActivationLink } = dataForSendingMessage;

  const defineMailRecipients = () => {
    if (process.env.MODE === "development") {
      return ["nikemorozow@gmail.com"];
    } else {
      if (!vbForm?.refFormId) {
        return [process.env.SERVICE_LICENSING_EMAIL];
      } else {
        return [
          process.env.SERVICE_INFO_EMAIL,
          vbForm.refFormId.researcher.email,
        ];
      }
    }
  };

  const linkMarkup = vbForm.videoLinks
    .map((link) => {
      return `<li>${link}</li>`;
    })
    .join("");

  const resourcesMarkup = vbForm.resources
    ?.map((site) => {
      return `<li style="color: #DC143C; text-decoration: none">${site}</li>`;
    })
    .join("");

  mailTransporter.sendMail({
    from: '"«VIRALBEAR» LLC" <info@viralbear.media>',
    to: defineMailRecipients(),
    subject: `New video was submitted! VB code: ${vbForm.formId.replace(
      "VB",
      ""
    )}`,
    html: `
<div>
<b style='font-size: 14px;'>Name:</b> ${vbForm.sender.name}<br>
<b style='font-size: 14px;'>Email:</b> ${vbForm.sender.email}<br>
<b style='font-size: 14px;'>Video link/s:</b><br>
<ul style="list-style: none; padding: 0; margin: 0">${linkMarkup}</ul><br>
<b style='font-size: 14px;'>Did you record:</b> ${
      !!vbForm.didYouRecord
        ? '<span style="color: #32CD32; font-weight: 400;">Yes</span>'
        : '<span style="color: #DC143C; font-weight: 400;">No</span>'
    }<br>
${
  vbForm.operator
    ? `<b style='font-size: 14px;'>Operator:</b> <span style="color: #DC143C; font-weight: 400;">${vbForm.operator}</span><br>`
    : ""
}
<b style='font-size: 14px;'>I didn’t submit or upload this video to any other site:</b> ${
      !!vbForm.noSubmitAnywhere
        ? '<span style="color: #32CD32; font-weight: 400;">Yes</span>'
        : '<span style="color: #DC143C; font-weight: 400;">No</span>'
    }<br>
${
  vbForm.resources.length
    ? `<b style='font-size: 14px;'>Resource/s:</b><br><ul style="list-style: none; padding: 0; margin: 0; font-weight: 400;">${resourcesMarkup}</ul><br>`
    : ""
}
<b style='font-size: 14px;'>Over 18 years old:</b> ${
      !!vbForm.over18YearOld
        ? '<span style="color: #32CD32; font-weight: 400;">Yes</span><br>'
        : '<span style="color: #DC143C; font-weight: 400;">No</span><br>'
    }
<b style='font-size: 14px;'>Agreed with terms:</b> ${
      !!vbForm.agreedWithTerms
        ? '<span style="color: #32CD32; font-weight: 400;">Yes</span><br>'
        : '<span style="color: #DC143C; font-weight: 400;">No</span><br>'
    }
<b style='font-size: 14px;'>Didn’t give rights:</b> ${
      !!vbForm.didNotGiveRights
        ? '<span style="color: #32CD32; font-weight: 400;">Yes</span><br>'
        : '<span style="color: #DC143C; font-weight: 400;">No</span><br>'
    }
${
  !!vbForm?.refFormId?.advancePayment
    ? `<b style='font-size: 14px;'>Advance payment:</b> <span style="font-weight: 400;">${vbForm.refFormId.advancePayment}</span><br>`
    : ""
}
${
  !!vbForm?.refFormId?.percentage
    ? `<b style='font-size: 14px;'>Percentage:</b> <span style="font-weight: 400;">${vbForm.refFormId.percentage}</span><br>`
    : ""
}
${
  !!vbForm?.refFormId?.researcher?.email
    ? `<b style='font-size: 14px;'>Researcher email:</b> <span style="font-weight: 400;">${vbForm.refFormId.researcher.email}</span><br>`
    : ""
}
${
  !!vbForm?.refFormId?.trelloCardUrl
    ? `<b style='font-size: 14px;'>Trello card URL:</b> <span style="font-weight: 400;">${vbForm.refFormId.trelloCardUrl}</span><br>`
    : ""
}
${
  !!vbForm.ip
    ? `<b style='font-size: 14px;'>IP:</b> <span style="font-weight: 400;">${vbForm.ip}</span><br>`
    : ""
} 
<b style='font-size: 14px;'>Submitted date:</b> <span style="font-weight: 400;">${
      vbForm.createdAt
    }</span><br>  
<b style='font-size: 14px;'>Contract:</b> <span style="font-weight: 400;">${
      vbForm.agreementLink
    }</span><br>  
<b style='font-size: 14px;'>Form VB code:</b> <span style="font-weight: 400;">${vbForm.formId.replace(
      "VB",
      ""
    )}</span><br>   
${
  !!accountActivationLink
    ? `<b style='font-size: 14px;'>Link to the personal account of the author ${vbForm.sender.name}:</b> <span style="font-weight: 400;">${accountActivationLink}}</span>`
    : ""
}
</div>
`,
  });
};

const sendAgreementToClientMail = async (dataForSendingAgreement) => {
  const { email, agreementLink, text } = dataForSendingAgreement;

  await mailTransporter.sendMail({
    from: '"«VIRALBEAR» LLC" <info@viralbear.media>',
    to: email,
    subject: `You just submitted your video to «VIRALBEAR» LLC`,
    html: text,
    attachments: [
      {
        filename: "agreement.pdf",
        path: agreementLink,
      },
    ],
  });
};

const sendSurveyInfoToServiceMail = async (dataForSendingSurveyInfo) => {
  const {
    whereFilmed,
    whenFilmed,
    whoAppears,
    whyDecide,
    whatHappen,
    formId,
    refForm,
    researcherEmail,
  } = dataForSendingSurveyInfo;

  const defineMailRecipients = () => {
    if (process.env.MODE === "development") {
      return ["nikemorozow@gmail.com"];
    } else {
      if (!!refForm && !!researcherEmail) {
        return [process.env.SERVICE_INFO_EMAIL, researcherEmail];
      } else {
        return process.env.SERVICE_LICENSING_EMAIL;
      }
    }
  };

  await mailTransporter.sendMail({
    from: '"«VIRALBEAR» LLC" <info@viralbear.media>',
    to: defineMailRecipients(),
    subject: `Information from the survey! VB code: ${formId.replace(
      "VB",
      ""
    )}`,
    html: `
    ${
      !!whereFilmed
        ? `<b style='font-size: 14px;'>Where was this video filmed (city):</b> <span style="font-weight: 400;">${whereFilmed}</span><br>`
        : ""
    }
    ${
      !!whenFilmed
        ? `<b style='font-size: 14px;'>When was this video filmed (date):</b> <span style="font-weight: 400;">${whenFilmed}</span><br>`
        : ""
    }
    ${
      !!whoAppears
        ? `<b style='font-size: 14px;'>Who appears in the video? Their names and ages?:</b> <span style="font-weight: 400;">${whoAppears}</span><br>`
        : ""
    }
    ${
      !!whyDecide
        ? `<b style='font-size: 14px;'>Why did you decide to film this video:</b> <span style="font-weight: 400;">${whyDecide}</span><br>`
        : ""
    }
    ${
      !!whatHappen
        ? `<b style='font-size: 14px;'>What is happening on the video:</b> <span style="font-weight: 400;">${whatHappen}</span><br>`
        : ""
    }
    <b style='font-size: 14px;'>Form VB code:</b> <span style="font-weight: 400;">${formId.replace(
      "VB",
      ""
    )}</span>
`,
  });
};

const sendEmail = ({ emailFrom, emailTo, subject, html, attachment }) => {
  mailTransporter.sendMail({
    from: emailFrom,
    to: emailTo,
    subject,
    ...(html && { html }),
    ...(attachment && {
      attachments: [
        {
          filename: "errors.json",
          content: attachment,
        },
      ],
    }),
  });
};

module.exports = {
  sendAgreementToClientMail,
  sendSurveyInfoToServiceMail,
  sendMainInfoByVBToServiceMail,
  sendEmail,
};
