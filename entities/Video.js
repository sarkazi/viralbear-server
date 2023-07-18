const { Schema, model } = require('mongoose');

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
        type: String,
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
      researchers: [
        {
          id: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
          },
          name: {
            type: String,
            required: true,
          },
          main: {
            type: Boolean,
            required: true,
          },
          type: Object,
          required: true,
        },
      ],

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
    uploadData: {
      agreementLink: {
        type: String,
        required: false,
      },
      vbCode: {
        type: String,
        required: false,
      },
      authorEmail: {
        type: String,
        required: false,
      },
      advancePayment: {
        type: Number,
        required: false,
      },
      percentage: {
        type: Number,
        required: false,
      },
      whereFilmed: {
        type: String,
        required: false,
      },
      whyDecide: {
        type: String,
        required: false,
      },
      whatHappen: {
        type: String,
        required: false,
      },
      whenFilmed: {
        type: String,
        required: false,
      },
      whoAppears: {
        type: String,
        required: false,
      },
    },
    brandSafe: {
      type: Boolean,
      default: false,
    },
    socialMedia: {
      type: Boolean,
      default: false,
    },
    reuters: {
      type: Boolean,
      default: true,
    },
    exclusivity: {
      type: Boolean,
      default: false,
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
    pubDate: {
      type: Date,
      required: false,
    },
    mRSS: {
      type: String,
      required: false,
    },
    mRSS2: {
      type: String,
      required: false,
    },
    mRSSConvertedVideos: {
      type: String,
      required: false,
    },
  },
  { timestamps: true }
);
module.exports = model('Video', schema);
