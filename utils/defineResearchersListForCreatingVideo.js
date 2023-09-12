const defineResearchersListForCreatingVideo = ({
  mainResearcher,
  allResearchersList,
  researcherWithPaidAdvance,
}) => {
  console.log(mainResearcher, researcherWithPaidAdvance);

  return allResearchersList.map((researcher) => {
    return {
      id: researcher._id,
      main: !mainResearcher
        ? false
        : mainResearcher._id.toString() === researcher._id.toString()
        ? true
        : false,
      name: researcher.name,
      ...(!!researcher.avatarUrl && { avatarUrl: researcher.avatarUrl }),
      email: researcher.email,
      advanceHasBeenPaid:
        !!researcherWithPaidAdvance &&
        researcher._id.toString() === researcherWithPaidAdvance.id.toString()
          ? true
          : false,
    };
  });
};

module.exports = { defineResearchersListForCreatingVideo };
