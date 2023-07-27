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
    advancePayment,
    percentage,
    researcherEmail,
    agreementLink,
    formId,
    refForm,
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
    to:
      refForm && !!researcherEmail
        ? [process.env.SERVICE_INFO_EMAIL, researcherEmail]
        : process.env.SERVICE_INFO_EMAIL,
    subject: `New video was submitted! ${formId}`,
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
   <b>Advance payment: ${advancePayment ? advancePayment : '-'}</b><br>
   <b>Percentage: ${percentage ? percentage : '-'}</b><br>
   <b>Researcher email: ${researcherEmail ? researcherEmail : '-'}</b><br>
   <b>IP: ${ip}</b><br>
   <b>Submitted date: ${createdAt}</b><br>
   <b>Contract: ${agreementLink}</b><br>
   <b>Form VB ID: ${formId.replace('VB', '')}</b><br>
   `,
  });
};

const sendAgreementToClientMail = async (dataForSendingAgreement) => {
  const { name, email, agreementLink, accountActivationLink } =
    dataForSendingAgreement;

  await mailTransporter.sendMail({
    from: '"«VIRALBEAR» LLC" <info@viralbear.media>',
    to: email,
    subject: `You just submitted your video to «VIRALBEAR» LLC`,
    html: accountActivationLink
      ? `
    Hello ${name}.<br/>
    Thank you for uploading the video to our platform.<br/>
    Link to your personal account on viralbear.media: ${accountActivationLink}. The agreement file is in the attachment of this letter.<br/>
    Have a nice day!
    `
      : `
    Hello ${name}.<br/>
    Thank you for uploading the video to our platform. The agreement file is in the attachment of this letter.<br/>
    Have a nice day!
    `,
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
      refForm && researcherEmail
        ? [process.env.SERVICE_INFO_EMAIL, researcherEmail]
        : process.env.SERVICE_LICENSING_EMAIL,
    subject: `information from the survey (form «${formId}»)`,
    html: `
         <b>Where was this video filmed: ${
           whereFilmed ? whereFilmed : '-'
         }</b><br>
         <b>When was this video filmed: ${whenFilmed ? whenFilmed : '-'}</b><br>
         <b>Who appears in the video? Their names and ages?: ${
           whoAppears ? whoAppears : '-'
         }</b><br>
         <b>Why did you decide to film this video: ${
           whyDecide ? whyDecide : '-'
         }</b><br>
         <b>What is happening on the video: ${
           whatHappen ? whatHappen : '-'
         }</b><br>
         <b>Form VB ID: ${formId.replace('VB', '')}</b><br>
         `,
  });
};

const sendEmail = async ({ emailFrom, emailTo, subject, html }) => {
  await mailTransporter.sendMail({
    from: emailFrom,
    to: emailTo,
    subject,
    html,
  });
};

module.exports = {
  sendAgreementToClientMail,
  sendSurveyInfoToServiceMail,
  sendMainInfoByVBToServiceMail,
  sendEmail,
};
