const path = require('path');
const multer = require('multer');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null,'./server/uploads/');
  },
  filename: (req, file, cb) => {
    var date = new Date();
    cb(null, date.getFullYear() + '-' + date.getMonth() + '-'+ date.getDate() + '-' +
      date.getHours() + '.' + date.getMinutes() + '.' + date.getSeconds() + '.' +
      date.getMilliseconds() + path.extname(file.originalname));
      // date.getMilliseconds() + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024*1024*5
  },
  fileFilter: fileFilter
});

module.exports = {upload};
