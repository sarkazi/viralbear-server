const moment = require('moment');

const generatingTextOfAgreement = (dynamicDataForAgreement) => {
  const {
    parseLocaleText,
    exclusivity,
    percentage,
    advancePayment,
    videoLinks,
    ipAddress,
    dynamicSignature,
    name,
    lastName,
    email,
  } = dynamicDataForAgreement;

  return `

      <!doctype html>
      <html>
         <head>
            <meta charset="utf-8">
            <title>PDF Result Template</title>
            <style>
              
              p {
                padding: unset;
                margin: unset;
              }
              .marginSm {
                margin-bottom: 6px;
              }
              .marginMd {
                margin-bottom: 17px;
              }
              .marginXs {
                margin-bottom: 12px;
              }
              .marginLg {
                margin-bottom: 28px;
              }
              .marginExtraLg {
                margin-bottom: 37px;
              }
              .marginFull {
                margin-bottom: 65px;
              }
              .textXs {
                font-size: 11px;
              },
              .textSm {
                font-size: 13px;
              }
              .textMd {
                font-size: 20px;
              }
              .textLg {
                font-size: 23px;
              }
              .weightMedium {
                font-weight: 500;
              }
              .weightBold {
                font-weight: 700;
              }
              .underline {
                text-decoration: underline;
              }
              
             
              
            </style>
         </head>
         <body>
        
           <div style='line-height: 140%; font-family: Arial, sans-serif;'>
             <div style=''>
             
                 <h1 class='marginExtraLg textLg' style='text-align: center; text-transform: uppercase; align-self: center;'>${
                   parseLocaleText.licenseAgreement
                 }</h1>
              
   
               <div class='marginMd' >
                 <p  class='textSm marginMd'>
                   ${
                     exclusivity === false
                       ? parseLocaleText.prelicenseNoExclusive
                       : parseLocaleText.prelicense
                   }
                 </p>
                 <div class='marginMd'>
                     <p  class='marginMd weightBold'>${
                       parseLocaleText.parties
                     }</p>
                     <p class='marginSm'>
                     ${
                       parseLocaleText.videoCopyrightHolderLicensor
                     }: ${name} ${lastName}
                     </p>
                     <p class='marginSm'>${parseLocaleText.email}: ${email}</p>
                   <p class='marginSm'>
                   ${parseLocaleText.videoIsExclusive}
                   </p>
                   <p >
                   ${parseLocaleText.userLicensee}: LLC «VIRALBEAR»
                   </p>
                 </div>
                 <div class='marginMd'>
                     <p class='marginMd weightBold'>${
                       parseLocaleText.subject
                     }</p>
                     <p class='textSm'>${parseLocaleText.linksOnVideo}:</p>
                     <ul class='marginSm'>
                      ${videoLinks
                        ?.map(
                          (link) => `<li class='textSm marginXs'>${link}</li>`
                        )
                        .join('')}
                     </ul>
                  
                     <p class="textSm ${
                       !ipAddress ? 'marginExtraLg' : 'marginSm'
                     }">${parseLocaleText.date}: ${moment()}</p>
                
                    ${
                      !!ipAddress
                        ? `<p class='textSm marginExtraLg'>${parseLocaleText.ipAddress}: ${ipAddress}</p>`
                        : ''
                    }

                 </div>
                 <p  class='textMd marginMd underline'>
                   ${parseLocaleText.guarantees}
                 </p>
                 <p  class='textSm marginXs'>
                   ${parseLocaleText.firstGuarantee}
                 </p>
                 <p class='textSm marginXs'>
                 ${parseLocaleText.secondGuarantee}
                  
                 </p>
                 <p class='textSm marginXs'>
                  
                   ${parseLocaleText.thridGuarantee}
                 </p>
                 <p class='textSm marginXs'>
             
                   ${parseLocaleText.fourthGuarantee}
                 </p>
                 <p  class='textSm marginMd'>
             
                   ${parseLocaleText.fifthGuarantee}
                 </p>
                 <p  class='textMd marginMd underline'>
                 
                   ${parseLocaleText.theRightsYouGrantUs}
                 </p>
                 <p  class='textSm marginXs'>
             
                   ${parseLocaleText.theRightsYouGrantUsText1}
                 </p>
   
                 <p  class='textSm marginXs'>
                   ${
                     exclusivity === false
                       ? parseLocaleText.theRightsYouGrantUsText2NoExclusive
                       : parseLocaleText.theRightsYouGrantUsText2
                   }
                 </p>
   
                 ${
                   !!percentage || !!advancePayment
                     ? `<p class="textSm marginXs">${parseLocaleText.dynamicTextFirst}</p>
                       <p class="textSm marginXs">${parseLocaleText.dynamicTextSecond}</p>`
                     : ''
                 }
   
                 <p  class='textMd marginMd underline'>
                 ${parseLocaleText.responsibility}
                 </p>
                 <p class='textSm marginMd'>
                 ${parseLocaleText.responsibilityText}
                 </p>
                 <p class='textMd marginMd underline'>
               
                   ${parseLocaleText.terminationOfTheAgreement}
                 </p>
                 <p class='textSm marginXs'>
                 
                   ${parseLocaleText.terminationOfTheAgreementText1}
                 </p>
                 <p  class='textSm marginXs'>
                  
                   ${parseLocaleText.terminationOfTheAgreementText2}
                 </p>
                 <p  class='textSm marginXs'>
                   
                   ${parseLocaleText.terminationOfTheAgreementText3}
                 </p>
                 <p  class='textSm marginMd'>
                  
                   ${parseLocaleText.terminationOfTheAgreementText4}
                 </p>
                 <p  class='textMd marginMd underline'>
             
                   ${parseLocaleText.disputeResolution}
                 </p>
                 <p  class='textSm marginMd'>
                  
                   ${parseLocaleText.disputeResolutionText}
                 </p>
                 <p  class='textMd marginMd underline'>
                   ${parseLocaleText.confidentiality}
                 </p>
                 <p class='textSm marginLg'>
                   ${parseLocaleText.confidentialityText}
                 </p>
                 <div>
                   <div
                  style='border-top: 1px solid rgb(203, 203, 203); padding-top: 10px'
                 
                   >
                     <p class='textXs marginXs' style='line-height: 120%;'>
                       ${parseLocaleText.subtext1}
                     </p>
   
                     <p  class='textXs marginFull' style='line-height: 120%;'>
                       ${parseLocaleText.subtext2}
                     </p>
   
                     <p  class='textMd marginLg weightBold' style='text-transform: uppercase; margin-bottom: 30px;'>
                     ${parseLocaleText.agreeAndAccepted}:
                     </p>
                   </div>
                   <div style='position: relative;'>
                     <div style='position: absolute; top: 0; left: 0; width: 50%; padding: 5px;'>
                       <p class='textMd marginMd'> ${
                         parseLocaleText.licensor
                       }</p>
                       <div class='marginLg'>
                         <p class='textSm marginMd'>
                         ${parseLocaleText.by}:
                         </p>
                         <div style='width: 100%;'>
                          <img style='width: 85%;' src='${dynamicSignature}'/>
                         </div>
                       </div>
   
                       <p class='textSm'>
                       ${parseLocaleText.name}: ${name} ${lastName}
                       </p>
                     </div>
                     <div style='position: absolute; top: 0; right: 0; width: 50%; padding: 5px;'>
                       <p class='textMd marginMd'>LLC «VIRALBEAR»</p>
   
                       <div class='marginLg'>
                         <p class='textSm marginMd'>
                         ${parseLocaleText.by}:
                         </p>
   
                         <div style='width: 100%;'>
                         <img style='width: 70%;' src='https://storage.yandexcloud.net/viralbear/other/signature.jpg'/>
                         </div>
                       </div>
   
                       <p class="textSm">
                         ${parseLocaleText.name}: Tatsiana Dziaikun
                       </p>
                     </div>
                   </div>
                 </div>
               </div>
             </div>
           </div>
        
         </body>
      </html>
      `;
};

module.exports = { generatingTextOfAgreement };
