const { google } = require("googleapis");
const { oAuth2Client } = require("./googleAuth");
const fs = require("fs");

const drive = google.drive({
  version: "v3",
  auth: oAuth2Client
});

/* =========================
   CREATE / GET FOLDER
========================= */
async function getOrCreateFolder(name, parent = null) {
  try {
    const query =
      `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false` +
      (parent ? ` and '${parent}' in parents` : "");

    const res = await drive.files.list({
      q: query,
      fields: "files(id, name)"
    });

    if (res.data.files.length > 0) {
      return res.data.files[0].id;
    }

    const folder = await drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: parent ? [parent] : []
      },
      fields: "id"
    });

    console.log("Folder created:", name);

    return folder.data.id;

  } catch (err) {
    console.error("Folder error:", err.message);
    throw err;
  }
}

/* =========================
   FAST UPLOAD FILE
========================= */
async function uploadToDrive(filePath, fileName, type, state = "General") {
  try {
    console.log("Uploading:", fileName);

    const mainFolderId = await getOrCreateFolder(type);
    const stateFolderId = await getOrCreateFolder(state, mainFolderId);

    const uniqueName = Date.now() + "-" + fileName;

    const response = await drive.files.create({
      requestBody: {
        name: uniqueName,
        parents: [stateFolderId]
      },
      media: {
        mimeType: "application/octet-stream",
        body: fs.createReadStream(filePath, {
          highWaterMark: 1024 * 1024 // 🚀 faster upload
        })
      },
      fields: "id"
    });

    const fileId = response.data.id;

    // 🚀 FAST MODE: skip permission (saves time)
    // If needed later, you can enable it again

    const webViewLink = `https://drive.google.com/file/d/${fileId}/view`;

    console.log("Upload success:", fileId);

    return {
      fileId,
      webViewLink
    };

  } catch (err) {
    console.error("Upload error:", err.message);
    throw err;
  }
}

/* =========================
   FAST DELETE FILE
========================= */
async function deleteFromDrive(fileId) {
  try {

    if (!fileId) {
      console.log("No fileId provided");
      return false;
    }

    console.log("Deleting file:", fileId);

    // 🚀 non-blocking delete
    drive.files.delete({ fileId }).catch(() => {});

    return true;

  } catch (err) {
    console.error("Delete error:", err.message);
    return false;
  }
}

module.exports = {
  uploadToDrive,
  deleteFromDrive
};