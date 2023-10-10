const {
  paramsForVideoConversion,
} = require('../const/paramsForVideoConversion');

describe('checkSizeConvertedVideo', () => {
  it('разрешение видео', () => {
    const smSize = paramsForVideoConversion.size.sm;
    const lgSize = paramsForVideoConversion.size.lg;

    expect(smSize).toEqual('1280x720');
    expect(lgSize).toEqual('1920x1080');
  });
});
