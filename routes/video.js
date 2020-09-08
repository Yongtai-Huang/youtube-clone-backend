const express = require("express");
const router = express.Router();
const { recommendedVideos } = require("../controllers/user");
const { protect } = require("../middlewares/auth");

const {
  newVideo,
  getVideo,
  likeVideo,
  dislikeVideo,
  addComment,
  newView,
  searchVideo,
  uploadVideo,
  updateVideo,
  deleteVideo,
  updateComment,
  deleteComment
} = require("../controllers/video");

router.route("/").post(protect, newVideo);
router.route("/").get(recommendedVideos);
router.route("/search").get(protect, searchVideo);
router.route("/:id").get(protect, getVideo);
router.route("/:id").put(protect, updateVideo);
router.route("/:id").delete(protect, deleteVideo);
router.route("/:id/like").get(protect, likeVideo);
router.route("/:id/dislike").get(protect, dislikeVideo);
router.route("/:id/comment").post(protect, addComment);
router.route("/comment/:commentId").put(protect, updateComment);
router.route("/comment/:commentId").delete(protect, deleteComment);
router.route("/:id/view").get(protect, newView);
router.route("/video").post(protect, uploadVideo);

module.exports = router;
