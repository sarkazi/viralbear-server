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

const getTrelloCardsFromDoneListByApprovedAndNot = async () => {
  const prePublishingVideos = await findReadyForPublication();

  const doneCardsFromTrello = await getAllCardsByListId(
    process.env.TRELLO_LIST_DONE_ID
  );

  const requiredCards = doneCardsFromTrello.filter((card) => {
    return (
      card.labels.some((label) => label.id === '61a1d74565c249483548bf9a') &&
      card.labels.some((label) => label.id === '6243c7bd3718c276cb21e2cb')
    );
  });

  let summaryData = await Promise.all(
    requiredCards.map(async (card) => {
      let vbForm = null;

      if (
        card.customFieldItems.find(
          (el) => el.idCustomField === '63e659f754cea8f9978e3b63'
        )
      ) {
        const vbFormId = card.customFieldItems.find(
          (el) => el.idCustomField === '63e659f754cea8f9978e3b63'
        ).value.number;

        vbForm = await findOne({ searchBy: 'formId', param: `VB${vbFormId}` });
      }

      return {
        id: card.id,
        name:
          card.name.length >= 20
            ? card.name.substring(0, 20) + '...'
            : card.name,
        priority: card.customFieldItems.find(
          (customField) => customField.idValue === '62c7e0032a86d7161f8cadb2'
        )
          ? true
          : false,

        hasAdvance: vbForm && vbForm?.refFormId?.advancePayment ? true : false,
        list: card.customFieldItems.find(
          (customField) => customField.idValue === '6360c514c95f85019ca4d612'
        )
          ? 'approve'
          : 'done',
        url: card.url,
      };
    })
  );

  summaryData = summaryData.reduce(
    (res, card) => {
      res[card.list === 'approve' ? 'approve' : 'done'].push(card);
      return res;
    },
    { approve: [], done: [] }
  );

  return {
    doneTasks: summaryData.done,
    approvedTasks: summaryData.approve.filter((approvedCard) => {
      return prePublishingVideos.every((prePublishVideo) => {
        return approvedCard.id !== prePublishVideo.trelloData.trelloCardId;
      });
    }),
  };
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

module.exports = {
  getAllCommentsByBoard,
  getTrelloCardsFromDoneListByApprovedAndNot,
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
};
