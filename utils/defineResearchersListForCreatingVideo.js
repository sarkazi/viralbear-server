const defineResearchersListForCreatingVideo = ({
  mainResearcher,
  allResearchersList,
}) => {
  return allResearchersList.map((researcher) => {
    return {
      id: researcher.id,
      main: !mainResearcher
        ? false
        : mainResearcher._id.toString() === researcher._id.toString()
        ? true
        : false,
      name: researcher.name,
      email: researcher.email,
      advanceHasBeenPaid: false,
    };
  });
};

module.exports = { defineResearchersListForCreatingVideo };
