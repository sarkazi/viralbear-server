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
<div style="display: flex;flex-direction: column; align-items: flex-start">
<b>Name:</b> ${vbForm.sender.name}<br>
   <b>Email:</b> ${vbForm.sender.email}<br>
   <b>Video link/s:</b><br>
   <ul style="list-style: none; padding: 0; margin: 0">${linkMarkup}</ul>
   <b>Did you record:</b> ${
     !!vbForm.didYouRecord
       ? '<b style="color: #32CD32">Yes</b>'
       : '<b style="color: #DC143C">No</b>'
   }
   ${
     vbForm.operator
       ? `<b>Operator:</b> <span style="color: #DC143C">${vbForm.operator}</span>`
       : `<b style="display:</b> none">`
   }
   <b>I didn’t submit or upload this video to any other site:</b> ${
     !!vbForm.noSubmitAnywhere
       ? '<b style="color: #32CD32">Yes</b>'
       : '<b style="color: #DC143C">No</b>'
   }
   ${
     vbForm.resources.length
       ? `<b>Resource/s:</b><br>
          <ul style="list-style: none; padding: 0; margin: 0">${resourcesMarkup}</ul>`
       : `<b style="display:</b> none">`
   }
   <b>Over 18 years old:</b> ${
     !!vbForm.over18YearOld
       ? '<b style="color: #32CD32">Yes'
       : '<b style="color: #DC143C">No>'
   }
   <b>Agreed with terms:</b> ${
     !!vbForm.agreedWithTerms
       ? '<b style="color: #32CD32">Yes'
       : '<b style="color: #DC143C">No'
   }
   <b>Didn’t give rights:</b> ${
     !!vbForm.didNotGiveRights
       ? '<b style="color: #32CD32">Yes'
       : '<b style="color: #DC143C">No'
   }
   ${
     !!vbForm?.refFormId?.advancePayment
       ? `<b>Advance payment:</b> ${vbForm.refFormId.advancePayment}`
       : ""
   }
   ${
     !!vbForm?.refFormId?.percentage
       ? `<b>Percentage:</b> ${vbForm.refFormId.percentage}`
       : ""
   }
   ${
     !!vbForm?.refFormId?.researcher?.email
       ? `<b>Researcher email:</b> ${vbForm.refFormId.researcher.email}`
       : ""
   }
   ${
     !!vbForm?.refFormId?.trelloCardUrl
       ? `<b>Trello card URL:</b> ${vbForm.refFormId.trelloCardUrl}`
       : ""
   }
   <b>IP:</b> ${vbForm.ip}
   <b>Submitted date:</b> ${vbForm.createdAt}
   <b>Contract:</b> ${vbForm.agreementLink}
   <b>Form VB code:</b> ${vbForm.formId.replace("VB", "")}
   ${
     !!accountActivationLink
       ? `<b>Link to the personal account of the author ${vbForm.sender.name}:</b> ${accountActivationLink}`
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
         <b>Where was this video filmed (city):</b> ${
           whereFilmed ? whereFilmed : "-"
         }<br>
         <b>When was this video filmed (date):</b> ${
           whenFilmed ? whenFilmed : "-"
         }<br>
         <b>Who appears in the video? Their names and ages?:</b> ${
           whoAppears ? whoAppears : "-"
         }<br>
         <b>Why did you decide to film this video:</b> ${
           whyDecide ? whyDecide : "-"
         }<br>
         <b>What is happening on the video:</b> ${
           whatHappen ? whatHappen : "-"
         }<br>
         <b>Form VB code:</b> ${formId.replace("VB", "")}<br>
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
