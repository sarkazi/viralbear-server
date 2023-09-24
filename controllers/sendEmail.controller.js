const mailTransporter = require('../nodemailer.instance');

const sendMainInfoByVBToServiceMail = async (dataForSendingMessage) => {
  const {
    name,
    clientEmail,
    videoLinks,
    didYouRecord,
    operator,
    resources,
    over18YearOld,
    agreedWithTerms,
    noSubmitAnywhere,
    didNotGiveRights,
    ip,
    createdAt,
    agreementLink,
    formId,
    refForm,
    accountActivationLink,
  } = dataForSendingMessage;

  const linkMarkup = videoLinks
    .map((link) => {
      return `<li>${link}</li>,`;
    })
    .join(', ');

  const resourcesMarkup = resources
    ?.map((site) => {
      return `<li style="color: #DC143C; text-decoration: none">${site}</li>,`;
    })
    .join(', ');

  await mailTransporter.sendMail({
    from: '"«VIRALBEAR» LLC" <info@viralbear.media>',
    to: !!refForm?.researcher?.email
      ? [process.env.SERVICE_INFO_EMAIL, refForm.researcher.email]
      : process.env.SERVICE_LICENSING_EMAIL,
    subject: `New video was submitted! VB code: ${+formId.replace('VB', '')}`,
    html: `

   <b>Name: ${name}</b><br>
   <b>Email: ${clientEmail}</b><br>
   <b>Video link/s:</b><br>
   <ul style="list-style: none; padding: 0; margin: 0">${linkMarkup}</ul>
   <b>Did you record: ${
     didYouRecord === true
       ? '<b style="color: #32CD32">Yes</b>'
       : '<b style="color: #DC143C">No</b>'
   }</b><br>
   ${
     operator
       ? `<b>Operator: <span style="color: #DC143C">${operator}</span></b><br></br>`
       : `<b style="display: none"></b>`
   }
   <b>I didn’t submit or upload this video to any other site: ${
     noSubmitAnywhere === true
       ? '<b style="color: #32CD32">Yes</b>'
       : '<b style="color: #DC143C">No</b>'
   }</b><br>
   ${
     resources
       ? `<b>Resource/s:</b><br>
          <ul style="list-style: none; padding: 0; margin: 0">${resourcesMarkup}</ul>`
       : `<b style="display: none"></b>`
   }
   <b>Over 18 years old: ${
     over18YearOld === true
       ? '<b style="color: #32CD32">Yes</b>'
       : '<b style="color: #DC143C">No</b>'
   }</b><br>
   <b>Agreed with terms: ${
     agreedWithTerms === true
       ? '<b style="color: #32CD32">Yes</b>'
       : '<b style="color: #DC143C">No</b>'
   }</b><br>
   <b>Didn’t give rights: ${
     didNotGiveRights === true
       ? '<b style="color: #32CD32">Yes</b>'
       : '<b style="color: #DC143C">No</b>'
   }</b><br>
   ${
     !!refForm?.advancePayment
       ? `<b>Advance payment: ${refForm.advancePayment}</b><br></br>`
       : ''
   }
   ${
     !!refForm?.percentage
       ? `<b>Percentage: ${refForm.percentage}</b><br></br>`
       : ''
   }
   ${
     !!refForm?.researcher?.email
       ? `<b>Researcher email: ${refForm.researcher.email}</b><br>`
       : ''
   }
   ${
     !!refForm?.trelloCardUrl
       ? `<b>Trello card URL: ${refForm.trelloCardUrl}</b><br>`
       : ''
   }
   <b>IP: ${ip}</b><br>
   <b>Submitted date: ${createdAt}</b><br>
   <b>Contract: ${agreementLink}</b><br>
   <b>Form VB code: ${formId.replace('VB', '')}</b><br>
   ${
     !!accountActivationLink
       ? `<b>Link to the personal account of the author ${name}: ${accountActivationLink}</b>`
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

  await mailTransporter.sendMail({
    from: '"«VIRALBEAR» LLC" <info@viralbear.media>',
    to:
      !!refForm && !!researcherEmail
        ? [process.env.SERVICE_INFO_EMAIL, researcherEmail]
        : process.env.SERVICE_LICENSING_EMAIL,
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
