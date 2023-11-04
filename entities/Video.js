const { Schema, model } = require("mongoose");

const schema = new Schema(
  {
    videoData: {
      videoId: {
        type: Number,
        required: true,
      },
      title: {
        type: String,
        required: true,
      },
      description: {
        type: String,
        required: true,
      },
      creditTo: {
        type: String,
        required: false,
      },
      tags: {
        type: [String],
        required: true,
      },
      category: {
        type: Array,
        required: true,
      },
      categoryReuters: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      country: {
        type: String,
        required: true,
      },
      countryCode: {
        type: String,
        required: true,
      },

      countryCode: {
        type: String,
        required: true,
      },
      date: {
        type: Date,
        required: true,
      },
      originalVideoLink: {
        type: Number,
        required: true,
      },
      duration: {
        type: String,
        required: true,
      },
      hasAudioTrack: {
        type: Boolean,
        required: true,
      },
      type: Object,
      required: true,
    },
    trelloData: {
      trelloCardUrl: {
        type: String,
        required: true,
      },
      trelloCardName: {
        type: String,
        required: true,
      },
      trelloCardId: {
        type: String,
        required: true,
      },
      researchers: {
        type: Map,
        of: new Schema({
          researcher: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
          },
          advanceHasBeenPaid: {
            type: Boolean,
            required: true,
            default: false,
          },
          main: {
            type: Boolean,
            required: true,
          },
        }),
      },

      priority: {
        type: Boolean,
        required: true,
      },
      type: Object,
      required: true,
    },
    bucket: {
      cloudVideoLink: {
        type: String,
        required: true,
      },
      cloudScreenLink: {
        type: String,
        required: true,
      },
      cloudVideoPath: {
        type: String,
        required: true,
      },
      cloudScreenPath: {
        type: String,
        required: true,
      },
      cloudConversionVideoLink: {
        type: String,
        required: true,
      },
      cloudConversionVideoPath: {
        type: String,
        required: true,
      },
    },
    needToBeFixed: {
      comment: {
        type: String,
        required: false,
      },
      type: Object,
      required: false,
    },
    commentToAdmin: {
      type: String,
      required: false,
    },
    vbForm: {
      type: Schema.Types.ObjectId,
      ref: "UploadInfo",
      required: false,
    },
    brandSafe: {
      type: Boolean,
      default: false,
    },
    socialMedia: {
      type: Boolean,
      default: false,
    },
    uploadedToFb: {
      type: Boolean,
      required: false,
      default: false,
    },
    uploadedToYoutube: {
      type: Boolean,
      required: false,
      default: false,
    },
    reuters: {
      type: Boolean,
      default: true,
    },
    apVideoHub: {
      type: Boolean,
      default: false,
    },
    apVideoHubArchive: {
      type: Boolean,
      required: false,
    },
    exclusivity: {
      type: Boolean,
      required: true,
    },
    publishedInSocialMedia: {
      type: Boolean,
      default: true,
    },
    isApproved: {
      type: Boolean,
      required: true,
      default: false,
    },
    wasRemovedFromPublication: {
      type: Boolean,
      required: false,
    },
    lastChange: {
      type: Date,
      required: false,
    },
    pubDate: {
      type: Date,
      required: false,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true }
);
module.exports = model("Video", schema);
