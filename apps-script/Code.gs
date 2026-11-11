/**
 * IMCSC Online Mart — Backend Web App
 * Deploy: Deploy > New deployment > Web app > Execute as Me > Anyone
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Orders');
    const orderId = 'IMCSC-' + Date.now();

    sheet.appendRow([
      new Date(),
      orderId,
      data.customer.name,
      data.customer.phone,
      data.customer.address,
      JSON.stringify(data.items),
      data.total,
      'Pending'
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success', orderId }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput('IMCSC Online Mart backend is live.');
}