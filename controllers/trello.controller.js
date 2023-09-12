const trelloInstance = require('../api/trello.instance');
const Video = require('../entities/Video');
const { findReadyForPublication } = require('../controllers/video.controller');

const { findOne } = require('../controllers/uploadInfo.controller');

const getAllCommentsByBoard = async () => {
  const response = await trelloInstance.get('/1/boards/qTvBYsA3/actions', {
    params: {
      filter: 'commentCard',
      limit: 1000,
      closed: false,
    },
  });

  return response;
};

const getCardDataByCardId = async (trelloCardId) => {
  const { data } = await trelloInstance.get(`/1/cards/${trelloCardId}`, {
    params: {
      customFieldItems: true,
      members: true,
    },
  });

  return data;
};

const getAllCardsByListId = async (listId) => {
  const { data } = await trelloInstance.get(
    `/1/lists/${listId}/cards/?customFieldItems=true`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
      params: {
        fields: ['name', 'url', 'labels', 'desc', 'due', 'dueComplete'],
        members: true,
      },
    }
  );

  return data;
};

const getPriorityCardByCardId = async (trelloCardId) => {
  const cardData = await getCardDataByCardId(trelloCardId);

  return {
    priority: cardData.customFieldItems.find(
      (customField) => customField.idValue === '62c7e0032a86d7161f8cadb2'
    )
      ? true
      : false,
  };
};

const getTrelloCardsFromMonthlyGoalsList = async () => {
  const { data } = await trelloInstance.get(
    `/1/lists/${process.env.TRELLO_LIST_MONTHLY_GOALS_ID}/cards/?customFieldItems=true`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
      params: {
        fields: ['name', 'url', 'labels', 'desc'],
        members: true,
      },
    }
  );

  return data;
};

const createNewAttachmentForTrelloCard = async (trelloCardId, body) => {
  const { data } = await trelloInstance.post(
    `https://api.trello.com/1/cards/${trelloCardId}/attachments`,
    body
  );

  return data;
};

const getAllChecklistsByTrelloCardId = async (trelloCardId) => {
  const { data } = await trelloInstance.get(
    `https://api.trello.com/1/cards/${trelloCardId}/checklists`
  );

  return data;
};

const createNewChecklistItemForTrelloCard = async (checklistId, value) => {
  const { data } = await trelloInstance.post(
    `https://api.trello.com/1/checklists/${checklistId}/checkItems`,
    {},
    {
      params: {
        name: value,
      },
    }
  );

  return data;
};

const updateTrelloCard = async (trelloCardId, valuesToChange) => {
  const { data } = await trelloInstance.put(
    `/1/cards/${trelloCardId}`,
    {},
    {
      params: valuesToChange,
    }
  );

  return data;
};

const getCardLabelsByCardId = async (trelloCardId) => {
  const cardData = await getCardDataByCardId(trelloCardId);

  return cardData.labels;
};

const addLabelToCard = async (trelloCardId, labelId) => {
  const { data } = await trelloInstance.post(
    `/1/cards/${trelloCardId}/idLabels`,
    {},
    {
      params: {
        value: labelId,
      },
    }
  );
};

const createCardInTrello = async (
  authorNickname,
  title,
  videoLink,
  list,
  foundWorkersTrelloIds
) => {
  const { data } = await trelloInstance.post(
    `1/cards?idList=63bdfa7ecbe3f5018172bdc8`,
    {
      name:
        authorNickname && title
          ? `@${authorNickname} ${title}`
          : !authorNickname && title
          ? `${title}`
          : authorNickname && !title
          ? `@${authorNickname}`
          : ' ',
      desc: videoLink,
      idMembers: foundWorkersTrelloIds,
      ...(list !== 'Review' && {
        idLabels: [
          list === 'To do'
            ? '61a1c05f33ccc35e92aab1fd'
            : '61a1c05f33ccc35e92aab202',
        ],
      }),
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  return data;
};

const findWorkersTrelloIds = async (foundWorkers) => {
  const { data } = await trelloInstance.get('/1/boards/qTvBYsA3/members');

  return data
    .filter((arrWorker) => {
      return foundWorkers.some((worker) => {
        return worker?.nickname.split('@')[1] === arrWorker.username;
      });
    })
    .map((finalWorker) => {
      return finalWorker.id;
    });
};

const updateCustomFieldByTrelloCard = async (
  trelloCardId,
  customFieldId,
  customFieldValueData
) => {
  return await trelloInstance.put(
    `/1/cards/${trelloCardId}/customField/${customFieldId}/item`,
    customFieldValueData
  );
};

const deleteLabelFromTrelloCard = async (trelloCardId, labelId) => {
  return await trelloInstance.delete(
    `/1/cards/${trelloCardId}/idLabels/${labelId}`
  );
};

const getCustomField = async (customFieldId) => {
  const { data } = await trelloInstance.get(`/1/customFields/${customFieldId}`);

  return data;
};

const definingValueOfCustomFieldReminderInTrello = async (
  customFieldId,
  reminder
) => {
  const customFieldData = await getCustomField(customFieldId);

  const searchForCustomFieldValue = (entry) => {
    return customFieldData.options.find((option) =>
      option.value.text.includes(entry)
    );
  };

  const reminderCustomFieldValue = await new Promise((resolve, reject) => {
    switch (reminder) {
      case '1 day':
        resolve(searchForCustomFieldValue('day'));
        break;
      case '1 week':
        resolve(searchForCustomFieldValue('week'));
        break;
      case '1 month':
        resolve(searchForCustomFieldValue('month'));
        break;
    }
  });

  return reminderCustomFieldValue;
};

const calculatingTimeUntilNextReminder = async (customFieldOption) => {
  const dateMlscUntilNextReminder = await new Promise((resolve, reject) => {
    switch (customFieldOption.value.text) {
      case 'every 1 day':
        resolve(24 * 60 * 60 * 1000);
        break;
      case 'every 1 week':
        resolve(7 * 24 * 60 * 60 * 1000);
        break;
      case 'every 1 month':
        resolve(30 * 24 * 60 * 60 * 1000);
        break;
    }
  });

  return dateMlscUntilNextReminder;
};

const removeLabelFromTrelloCard = async (trelloCardId, trelloLabelId) => {
  const { data } = await trelloInstance.delete(
    `/1/cards/${trelloCardId}/idLabels/${trelloLabelId}`
  );

  return data;
};

const getAllMembers = async () => {
  const { data } = await trelloInstance.get(
    `/1/boards/${process.env.TRELLO_WORKSPACE_ID}/members`
  );

  return data;
};

const getTrelloMemberById = async (memberId) => {
  const { data } = await trelloInstance.get(`/1/members/${memberId}`);

  return data;
};

const inviteMemberOnBoard = async ({ email, nickname }) => {
  const { data } = await trelloInstance.get(
    `/1/boards/${process.env.TRELLO_WORKSPACE_ID}/members?email=${email}`,
    {
      fullName: nickname,
    }
  );

  return data;
};

const getAllCardsFromTrello = async () => {
  const { data } = await trelloInstance.get(
    `/1/boards/${process.env.TRELLO_WORKSPACE_ID}/cards`,
    {
      params: {
        customFieldItems: true,
        members: true,
      },
    }
  );

  return data;
};

module.exports = {
  getAllCommentsByBoard,
  getPriorityCardByCardId,
  getCardDataByCardId,
  getTrelloCardsFromMonthlyGoalsList,
  createNewAttachmentForTrelloCard,
  createNewChecklistItemForTrelloCard,
  getAllChecklistsByTrelloCardId,
  getCardLabelsByCardId,
  addLabelToCard,
  updateTrelloCard,
  createCardInTrello,
  findWorkersTrelloIds,
  updateCustomFieldByTrelloCard,
  definingValueOfCustomFieldReminderInTrello,
  calculatingTimeUntilNextReminder,
  removeLabelFromTrelloCard,
  getCustomField,
  getAllCardsByListId,
  getAllMembers,
  getTrelloMemberById,
  inviteMemberOnBoard,
  deleteLabelFromTrelloCard,
  getAllCardsFromTrello,
};
