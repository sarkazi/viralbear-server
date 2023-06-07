const XLSX = require('xlsx');

const exportsVideoToExcel = (
  dataFromFoundVideo,
  columnList,
  workSheetName,
  filePathExcel
) => {
  const data = dataFromFoundVideo.map((video) => {
    return [
      video.id,
      video.title,
      video.videoLink,
      video.story,
      video.date,
      video.city,
      video.country,
      video.keywords,
    ];
  });

  const workBook = XLSX.utils.book_new();
  const workSheetData = [columnList, ...data];
  const workSheet = XLSX.utils.aoa_to_sheet(workSheetData);
  XLSX.utils.book_append_sheet(workBook, workSheet, workSheetName);
  XLSX.writeFile(workBook, filePathExcel);
  return true;
};

module.exports = { exportsVideoToExcel };
