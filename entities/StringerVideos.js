const { Schema, model } = require("mongoose");

const schema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    link: {
      type: String,
      required: true,
    },
    sentCommentToStringer: {
      type: Boolean,
      default: false,
    },
    comments: {
      type: Array,
      default: [],
    },
    assignedTo: {
      type: String,
      required: false,
    },
  },
  { timestamps: true }
);

module.exports = model("StringerVideos", schema);
