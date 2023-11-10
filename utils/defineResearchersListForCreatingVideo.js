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
      advanceHasBeenPaid: Boolean(
        !!researcherWithPaidAdvance &&
          researcher._id.toString() ===
            researcherWithPaidAdvance.researcher._id.toString()
      ),
      ...(advanceToResearcher &&
        researcher._id.toString() === mainResearcher._id.toString() && {
          advanceValue: advanceToResearcher,
        }),
    };
  });
};

module.exports = { defineResearchersListForCreatingVideo };
