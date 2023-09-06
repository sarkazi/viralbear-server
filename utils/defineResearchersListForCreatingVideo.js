const defineResearchersListForCreatingVideo = ({
  mainResearcher,
  allResearchersList,
}) => {
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
      advanceHasBeenPaid: false,
    };
  });
};

module.exports = { defineResearchersListForCreatingVideo };
