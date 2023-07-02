const defineResearchersListForCreatingVideo = async ({
  mainResearcher,
  allResearchersList,
}) => {
  if (
    !allResearchersList.find(
      (researcher) =>
        researcher._id.toString() === mainResearcher._id.toString()
    )
  ) {
    allResearchersList = [...allResearchersList, mainResearcher];
  }

  const researchersListForCreatingVideo = allResearchersList.map(
    (researcher) => {
      return {
        id: researcher.id,
        main:
          mainResearcher._id.toString() === researcher._id.toString()
            ? true
            : false,
        name: researcher.name,
        email: researcher.email,
      };
    }
  );

  return researchersListForCreatingVideo;
};

module.exports = { defineResearchersListForCreatingVideo };
