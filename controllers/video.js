const multer  = require('multer');
const path = require('path');
const ffmpeg = require('ffmpeg');

const { Op } = require("sequelize");
const {
  User,
  Video,
  VideoLike,
  Comment,
  View,
  Subscription
} = require("../sequelize");
const asyncHandler = require("../middlewares/asyncHandler");
const fileHandler = require('../shared/fileHandler');

const videoFiletypes = /mp4|ogv|ogg|webm|mov|quicktime/;
const videoFileSizeLimit = 20 * Math.pow(1024, 3); //20 GB
const videos_dir = path.join(__dirname, '..', 'upload/videos');

const video_storage = multer.diskStorage({
  destination: videos_dir
});

// video files
const video_upload = multer({
  storage: video_storage,
  limits: {fileSize: videoFileSizeLimit},
  fileFilter: (req, file, cb) => {
    fileHandler.fileTypeCheck(videoFiletypes, file, cb);
  }
}).single('file');

const formatDuration = ts => {
  const hh = Math.floor(ts / 3600);
  const mm = Math.floor((ts % 3600)/60);
  const ss = Math.floor(ts % 60);

  let duration = '';
  if (hh > 0) {
    duration += hh.toString() + ':';
  }

  if ( hh > 0 && mm >= 0 && mm < 10 ) {
    duration += '0' + mm.toString() + ':';
  } else {
    duration += mm.toString() + ':';
  }

  if ( ss >= 0 && ss < 10) {
    duration += '0' + ss.toString();
  } else {
    duration += ss.toString();
  }

  return duration;
}

exports.uploadVideo = asyncHandler(async (req, res, next) => {
  video_upload(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(422).json({errors: {'File size': `is too large. Max limit is ${videoFileSizeLimit} GB.`}});
      } else if (err.code === 'filetype') {
        return res.status(422).json({errors: {'File type': "is invalid. Must be .mp4, .ogv, .webm, or .mov."}});
      } else {
        return res.status(422).json({errors: {Err: "to submit."}});
      }
    }
  
    const data = await fileHandler.renameFile(videos_dir, req.file);
    let thumbnailFilename = '';
    let duration = '';
    if (!data) {
      return next({
        message: 'Cannot save the video file',
        statusCode: 400
      });
    }
    
    thumbnailFilename = data.filename.split('.')[0] + '.jpg';
    const process = new ffmpeg(path.join(videos_dir, data.filename));
    return process.then( async (video) => {
      if (!video) {
        return next({
          message: 'Cannot process the video file',
          statusCode: 400
        });
      }

      if (video.metadata && video.metadata.duration && video.metadata.duration.seconds) {
        duration = formatDuration(video.metadata.duration.seconds);
      }

      video.addCommand('-ss', '00:00:05')
      video.addCommand('-vframes', '1')

      const file = await video.save(path.join(videos_dir, thumbnailFilename));

      if (file) {
        res.status(200).json({
          success: true,
          filename: data.filename,
          thumbnail: thumbnailFilename,
          duration: duration
        });
      } else {
        return next({
          message: error.message || 'Cannot generate the poster file',
          statusCode: 400
        });
      }
    });
 
  });
});

exports.newVideo = asyncHandler(async (req, res, next) => {
  const video = await Video.create({
    ...req.body,
    userId: req.user.id
  });

  res.status(200).json({ success: true, data: video });
});

exports.updateVideo = asyncHandler(async (req, res, next) => {
  const video = await Video.findByPk(req.params.id, {
    include: [
      {
        model: User,
        attributes: ["id", "username", "avatar"]
      }
    ]
  });

  if (!video) {
    return next({
      message: `No video found for ID - ${req.params.id}`,
      statusCode: 404
    });
  }

  // check whether you can modify it or not
  if (video.userId !== req.user.id) {
    return next({
      message: `You are not allowed to update the video`,
      statusCode: 401
    });
  }

  // update the values of some video properties
  video.title = req.body.title;
  video.description = req.body.description;

  if (req.body.url && req.body.url !== video.url) {
    await fileHandler.removeFile(videos_dir, video.url);
    video.url = req.body.url;
  }
  
  if (req.body.thumbnail && req.body.thumbnail !== video.thumbnail ) {
    await fileHandler.removeFile(videos_dir, video.thumbnail);
    video.thumbnail = req.body.thumbnail;
  }
  
  if (req.body.duration && req.body.duration !== video.duration) {
    video.duration = req.body.duration;
  }
  
  await video.save();
  res.status(200).json({ success: true, data: video });
});

exports.deleteVideo = asyncHandler(async (req, res, next) => {
  const video = await Video.findByPk(req.params.id);

  if (!video) {
    return next({
      message: `No video found for ID - ${req.params.id}`,
      statusCode: 404
    });
  }

  // check whether you can delete it or not
  if (video.userId !== req.user.id) {
    return next({
      message: `You are not allowed to update the video`,
      statusCode: 401
    });
  }

  await fileHandler.removeFile(videos_dir, video.url);
  await fileHandler.removeFile(videos_dir, video.thumbnail);

  await VideoLike.destroy({
    where: {videoId: video.id}
  });

  await Comment.destroy({
    where: {videoId: video.id}
  });

  await View.destroy({
    where: {videoId: video.id}
  });

  await video.destroy();
  res.status(200).json({ success: true, data: {} });
});

exports.getVideo = asyncHandler(async (req, res, next) => {
  const video = await Video.findByPk(req.params.id, {
    include: [
      {
        model: User,
        attributes: ["id", "username", "avatar"]
      }
    ]
  });

  if (!video) {
    return next({
      message: `No video found for ID - ${req.params.id}`,
      statusCode: 404
    });
  }

  const comments = await video.getComments({
    order: [["createdAt", "DESC"]],
    attributes: ["id", "text", "createdAt"],
    include: [
      {
        model: User,
        attributes: ["id", "username", "avatar"]
      }
    ]
  });

  const isLiked = await VideoLike.findOne({
    where: {
      [Op.and]: [
        { videoId: req.params.id },
        { userId: req.user.id },
        { like: 1 }
      ]
    }
  });

  const isDisliked = await VideoLike.findOne({
    where: {
      [Op.and]: [
        { videoId: req.params.id },
        { userId: req.user.id },
        { like: -1 }
      ]
    }
  });

  const commentsCount = await Comment.count({
    where: {
      videoId: req.params.id
    }
  });

  const likesCount = await VideoLike.count({
    where: {
      [Op.and]: [{ videoId: req.params.id }, { like: 1 }]
    }
  });

  const dislikesCount = await VideoLike.count({
    where: {
      [Op.and]: [{ videoId: req.params.id }, { like: -1 }]
    }
  });

  const views = await View.count({
    where: {
      videoId: req.params.id
    }
  });

  const isSubscribed = await Subscription.findOne({
    where: {
      subscriber: req.user.id,
      subscribeTo: video.userId
    },
  });

  const isViewed = await View.findOne({
    where: {
      userId: req.user.id,
      videoId: video.id
    }
  });

  const subscribersCount = await Subscription.count({
    where: { subscribeTo: video.userId }
  });

  const isVideoMine = req.user.id === video.userId;

  // likesCount, disLikesCount, views
  video.setDataValue("comments", comments);
  video.setDataValue("commentsCount", commentsCount);
  video.setDataValue("isLiked", !!isLiked);
  video.setDataValue("isDisliked", !!isDisliked);
  video.setDataValue("likesCount", likesCount);
  video.setDataValue("dislikesCount", dislikesCount);
  video.setDataValue("views", views);
  video.setDataValue("isVideoMine", isVideoMine);
  video.setDataValue("isSubscribed", !!isSubscribed);
  video.setDataValue("isViewed", !!isViewed);
  video.setDataValue("subscribersCount", subscribersCount);

  res.status(200).json({ success: true, data: video });
});

// Added by hyt
// exports.updateVideo = asyncHandler(async (req, res, next) => {
//   // TODO
// })

// Delete video
// exports.deleteVideo = asyncHandler(async (req, res, next) => {
//   // TODO
// })

exports.likeVideo = asyncHandler(async (req, res, next) => {
  const video = await Video.findByPk(req.params.id);
  if (!video) {
    return next({
      message: `No video found for ID - ${req.params.id}`,
      statusCode: 404
    });
  }

  const liked = await VideoLike.findOne({
    where: {
      userId: req.user.id,
      videoId: req.params.id,
      like: 1
    }
  });

  const disliked = await VideoLike.findOne({
    where: {
      userId: req.user.id,
      videoId: req.params.id,
      like: -1
    }
  });

  if (liked) {
    await liked.destroy();
  } else if (disliked) {
    disliked.like = 1;
    await disliked.save();
  } else {
    await VideoLike.create({
      userId: req.user.id,
      videoId: req.params.id,
      like: 1
    });
  }

  const isLiked = await VideoLike.findOne({
    where: {
      [Op.and]: [
        { videoId: req.params.id },
        { userId: req.user.id },
        { like: 1 }
      ]
    }
  });

  const isDisliked = await VideoLike.findOne({
    where: {
      [Op.and]: [
        { videoId: req.params.id },
        { userId: req.user.id },
        { like: -1 }
      ]
    }
  });

  const likesCount = await VideoLike.count({
    where: {
      [Op.and]: [{ videoId: req.params.id }, { like: 1 }]
    }
  });

  const dislikesCount = await VideoLike.count({
    where: {
      [Op.and]: [{ videoId: req.params.id }, { like: -1 }]
    }
  });

  video.setDataValue("isLiked", !!isLiked);
  video.setDataValue("isDisliked", !!isDisliked);
  video.setDataValue("likesCount", likesCount);
  video.setDataValue("dislikesCount", dislikesCount);

  res.json({ success: true, data: video });
});

exports.dislikeVideo = asyncHandler(async (req, res, next) => {
  const video = await Video.findByPk(req.params.id);

  if (!video) {
    return next({
      message: `No video found for ID - ${req.params.id}`,
      statusCode: 404
    });
  }

  const liked = await VideoLike.findOne({
    where: {
      userId: req.user.id,
      videoId: req.params.id,
      like: 1
    }
  });

  const disliked = await VideoLike.findOne({
    where: {
      userId: req.user.id,
      videoId: req.params.id,
      like: -1
    }
  });

  if (disliked) {
    await disliked.destroy();
  } else if (liked) {
    liked.like = -1;
    await liked.save();
  } else {
    await VideoLike.create({
      userId: req.user.id,
      videoId: req.params.id,
      like: -1
    });
  }

  const isLiked = await VideoLike.findOne({
    where: {
      [Op.and]: [
        { videoId: req.params.id },
        { userId: req.user.id },
        { like: 1 }
      ]
    }
  });

  const isDisliked = await VideoLike.findOne({
    where: {
      [Op.and]: [
        { videoId: req.params.id },
        { userId: req.user.id },
        { like: -1 }
      ]
    }
  });

  const likesCount = await VideoLike.count({
    where: {
      [Op.and]: [{ videoId: req.params.id }, { like: 1 }]
    }
  });

  const dislikesCount = await VideoLike.count({
    where: {
      [Op.and]: [{ videoId: req.params.id }, { like: -1 }]
    }
  });

  video.setDataValue("isLiked", !!isLiked);
  video.setDataValue("isDisliked", !!isDisliked);
  video.setDataValue("likesCount", likesCount);
  video.setDataValue("dislikesCount", dislikesCount);

  res.json({ success: true, data: video });
});

exports.addComment = asyncHandler(async (req, res, next) => {
  const video = await Video.findByPk(req.params.id);

  if (!video) {
    return next({
      message: `No video found for ID - ${req.params.id}`,
      statusCode: 404
    });
  }

  const comment = await Comment.create({
    text: req.body.text,
    userId: req.user.id,
    videoId: req.params.id
  });

  const User = {
    id: req.user.id,
    avatar: req.user.avatar,
    username: req.user.username
  };

  comment.setDataValue("User", User);

  res.status(200).json({ success: true, data: comment });
});

exports.updateComment = asyncHandler(async (req, res, next) => {
  const comment = await Comment.findByPk(req.params.commentId, {
    include: [
      {
        model: User,
        attributes: ["id", "username", "avatar"]
      }
    ]
  });

  if (!comment) {
    return next({
      message: `No comment found for ID - ${req.params.commentId}`,
      statusCode: 404
    });
  }

  if (comment.userId !== req.user.id) {
    return next({
      message: `You are not allowed to update the comment`,
      statusCode: 401
    });
  }

  comment.text = req.body.text;

  const updatedComment = await comment.save();

  res.status(200).json({ success: true, data: updatedComment });

});

// Added by hyt
exports.deleteComment = asyncHandler(async (req, res, next) => {
  const comment = await Comment.findByPk(req.params.commentId, {
    include: [
      {
        model: User,
        attributes: ["id", "username", "avatar"]
      }
    ]
  });

  if (!comment) {
    return next({
      message: `No comment found for ID - ${req.params.commentId}`,
      statusCode: 404
    });
  }

  if (comment.userId !== req.user.id) {
    return next({
      message: `You are not allowed to update the comment`,
      statusCode: 401
    });
  }

  await comment.destroy();

  res.status(200).json({ success: true, data: {} });
});

exports.newView = asyncHandler(async (req, res, next) => {
  const video = await Video.findByPk(req.params.id);

  if (!video) {
    return next({
      message: `No video found for ID - ${req.params.id}`,
      statusCode: 404
    });
  }

  const viewed = await View.findOne({
    where: {
      userId: req.user.id,
      videoId: req.params.id
    }
  });

  if (viewed) {
    return next({ message: "You already viewed this video", statusCode: 400 });
  }

  await View.create({
    userId: req.user.id,
    videoId: req.params.id
  });

  res.status(200).json({ success: true, data: {} });
});

exports.searchVideo = asyncHandler(async (req, res, next) => {
  if (!req.query.searchterm) {
    return next({ message: "Please enter the searchterm", statusCode: 400 });
  }

  const videos = await Video.findAll({
    include: { model: User, attributes: ["id", "avatar", "username"] },
    where: {
      [Op.or]: {
        title: {
          [Op.substring]: req.query.searchterm
        },
        description: {
          [Op.substring]: req.query.searchterm
        }
      }
    }
  });

  if (!videos.length)
    return res.status(200).json({ success: true, data: videos });

  videos.forEach(async (video, index) => {
    const views = await View.count({ where: { videoId: video.id } });
    video.setDataValue("views", views);

    if (index === videos.length - 1) {
      return res.status(200).json({ success: true, data: videos });
    }
  });
});
