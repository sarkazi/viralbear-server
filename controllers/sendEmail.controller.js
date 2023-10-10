const mailTransporter = require('../nodemailer.instance');

const sendMainInfoByVBToServiceMail = (dataForSendingMessage) => {
  const { vbForm, accountActivationLink } = dataForSendingMessage;

  const defineMailRecipients = () => {
    if (process.env.MODE === 'development') {
      return ['nikemorozow@gmail.com'];
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
      return `<li>${link}</li>,`;
    })
    .join(', ');

  const resourcesMarkup = vbForm.resources
    ?.map((site) => {
      return `<li style="color: #DC143C; text-decoration: none">${site}</li>,`;
    })
    .join(', ');

  mailTransporter.sendMail({
    from: '"«VIRALBEAR» LLC" <info@viralbear.media>',
    to: defineMailRecipients(),
    subject: `New video was submitted! VB code: ${vbForm.formId.replace(
      'VB',
      ''
    )}`,
    html: `

   <b>Name: ${vbForm.sender.name}</b><br>
   <b>Email: ${vbForm.sender.email}</b><br>
   <b>Video link/s:</b><br>
   <ul style="list-style: none; padding: 0; margin: 0">${linkMarkup}</ul>
   <b>Did you record: ${
     !!vbForm.didYouRecord
       ? '<b style="color: #32CD32">Yes</b>'
       : '<b style="color: #DC143C">No</b>'
   }</b><br>
   ${
     vbForm.operator
       ? `<b>Operator: <span style="color: #DC143C">${vbForm.operator}</span></b><br></br>`
       : `<b style="display: none"></b>`
   }
   <b>I didn’t submit or upload this video to any other site: ${
     !!vbForm.noSubmitAnywhere
       ? '<b style="color: #32CD32">Yes</b>'
       : '<b style="color: #DC143C">No</b>'
   }</b><br>
   ${
     vbForm.resources.length
       ? `<b>Resource/s:</b><br>
          <ul style="list-style: none; padding: 0; margin: 0">${resourcesMarkup}</ul>`
       : `<b style="display: none"></b>`
   }
   <b>Over 18 years old: ${
     !!vbForm.over18YearOld
       ? '<b style="color: #32CD32">Yes</b>'
       : '<b style="color: #DC143C">No</b>'
   }</b><br>
   <b>Agreed with terms: ${
     !!vbForm.agreedWithTerms
       ? '<b style="color: #32CD32">Yes</b>'
       : '<b style="color: #DC143C">No</b>'
   }</b><br>
   <b>Didn’t give rights: ${
     !!vbForm.didNotGiveRights
       ? '<b style="color: #32CD32">Yes</b>'
       : '<b style="color: #DC143C">No</b>'
   }</b><br>
   ${
     !!vbForm?.refFormId?.advancePayment
       ? `<b>Advance payment: ${vbForm.refFormId.advancePayment}</b><br></br>`
       : ''
   }
   ${
     !!vbForm?.refFormId?.percentage
       ? `<b>Percentage: ${vbForm.refFormId.percentage}</b><br></br>`
       : ''
   }
   ${
     !!vbForm?.refFormId?.researcher?.email
       ? `<b>Researcher email: ${vbForm.refFormId.researcher.email}</b><br>`
       : ''
   }
   ${
     !!vbForm?.refFormId?.trelloCardUrl
       ? `<b>Trello card URL: ${vbForm.refFormId.trelloCardUrl}</b><br>`
       : ''
   }
   <b>IP: ${vbForm.ip}</b><br>
   <b>Submitted date: ${vbForm.createdAt}</b><br>
   <b>Contract: ${vbForm.agreementLink}</b><br>
   <b>Form VB code: ${vbForm.formId.replace('VB', '')}</b><br>
   ${
     !!accountActivationLink
       ? `<b>Link to the personal account of the author ${vbForm.sender.name}: ${accountActivationLink}</b>`
       : ''
   }
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
        filename: 'agreement.pdf',
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
    if (process.env.MODE === 'development') {
      return ['nikemorozow@gmail.com'];
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
      'VB',
      ''
    )}`,
    html: `
         <b>Where was this video filmed (city): ${
           whereFilmed ? whereFilmed : '-'
         }</b><br>
         <b>When was this video filmed (date): ${
           whenFilmed ? whenFilmed : '-'
         }</b><br>
         <b>Who appears in the video? Their names and ages?: ${
           whoAppears ? whoAppears : '-'
         }</b><br>
         <b>Why did you decide to film this video: ${
           whyDecide ? whyDecide : '-'
         }</b><br>
         <b>What is happening on the video: ${
           whatHappen ? whatHappen : '-'
         }</b><br>
         <b>Form VB code: ${formId.replace('VB', '')}</b><br>
         `,
  });
};

const sendEmail = ({ emailFrom, emailTo, subject, html }) => {
  return new Promise((resolve, reject) => {
    mailTransporter.sendMail(
      {
        from: emailFrom,
        to: emailTo,
        subject,
        html,
      },
      (error, info) => {
        if (error) {
          resolve({ status: 'error', info: error });
        } else {
          resolve({ status: 'success', info });
        }
      }
    );
  });
};

module.exports = {
  sendAgreementToClientMail,
  sendSurveyInfoToServiceMail,
  sendMainInfoByVBToServiceMail,
  sendEmail,
};
