const defaultAdvanceValueToResearcher = require("../const/defaultAdvanceValueToResearcher");

const defineResearchersListForCreatingVideo = ({
  mainResearcher,
  allResearchersList,
  researcherWithPaidAdvance,
  advanceToResearcher,
}) => {
  return allResearchersList.map((researcher) => {
    return {
      researcher: researcher._id,
      main: !mainResearcher
        ? false
        : mainResearcher._id.toString() === researcher._id.toString()
        ? true
        : false,
      advanceHasBeenPaid:
        !!researcherWithPaidAdvance &&
        researcher._id.toString() ===
          researcherWithPaidAdvance.researcher._id.toString()
          ? true
          : false,
      advanceValue:
        advanceToResearcher &&
        researcher._id.toString() === mainResearcher._id.toString()
          ? advanceToResearcher
          : defaultAdvanceValueToResearcher,
    };
  });
};

module.exports = { defineResearchersListForCreatingVideo };
