const defineResearchersListForCreatingVideo = ({
  mainResearcher,
  allResearchersList,
  researcherWithPaidAdvance,
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
      ...(mainResearcher._id.toString() === researcher._id.toString() && {
        advance: 10,
      }),
    };
  });
};

module.exports = { defineResearchersListForCreatingVideo };
