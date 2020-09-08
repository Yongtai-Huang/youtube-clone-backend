const { promises: fs } = require("fs");
const path = require('path');

exports.renameFile = async (dir, file) => {
  try {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = "v" + (new Date).valueOf() + ext;
    await fs.rename(file.path, path.join(dir, filename));
    const data = {
      filename: filename,
      ext: ext
    };
    return data;
  } catch(err) {
    throw (err);
  }
};

// Check File Type
exports.fileTypeCheck = (filetypes, file, cb) => {
  // Check ext
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  // Check mime
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    const err = new Error();
    err.code = 'filetype';
    return cb(err);
  }
}

// Remove one file
exports.removeFile = async (dir, filename) => {
  try {
    await fs.unlink(path.join(dir, filename));
    return;
  } catch (err) {
    throw err;
  }
}
