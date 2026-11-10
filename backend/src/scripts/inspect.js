const XLSX = require('xlsx');
const path = require('path');
const excelFilePath = path.join(__dirname, '../../../IV_Year_Students_Data.xlsx');

try {
  const workbook = XLSX.readFile(excelFilePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet);
  console.log('Sheet Name:', sheetName);
  console.log('Row count:', rows.length);
  if (rows.length > 0) {
    console.log('First Row Keys:', Object.keys(rows[0]));
    console.log('First Row Values:', rows[0]);
  }
} catch (err) {
  console.error(err);
}
