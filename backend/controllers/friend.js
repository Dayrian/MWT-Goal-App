const Friend = require("../models/friend");
const User = require("../models/user");
const mongoose = require("mongoose");

//send freind request
const sendFriendReq = async (req, res) => {
  try {
    const { friendId, username } = req.body;

    let userToAdd;

    if (friendId) {
      // If the user selected from the dropdown
      userToAdd = await User.findById(friendId);
    } else if (username) {
      // If the user typed a username
      userToAdd = await User.findOne({ username: username });
    }

    if (!userToAdd) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if friend request already exists
    const existingReq = await Friend.findOne({
      user: req.user.id,
      friend: userToAdd._id,
    });

    if (existingReq) {
      return res.status(400).json({
        message: "Friend request already exists",
      });
    }

    // Create the friend request
    const friendReq = await Friend.create({
      user: req.user.id,
      friend: userToAdd._id,
      status: "pending",
    });

    res.redirect("/api/friends");
  } catch (err) {
    res.status(500).json({
      error: err.message || "Error sending friend request",
    });
  }
};

//Accept Friend Request
const acceptFriendReq = async (req, res) => {
  try {
    const { requestId } = req.params;

    // Make sure the requestId is a valid ObjectId (remove extra quotes or spaces if needed)
    const cleanedRequestId = requestId.trim().replace(/['"]+/g, "");

    if (!mongoose.Types.ObjectId.isValid(cleanedRequestId)) {
      return res.status(400).json({
        message: "Invalid Friend Request ID",
      });
    }

    const friendReq = await Friend.findById(cleanedRequestId);

    if (!friendReq || friendReq.friend.toString() !== req.user.id) {
      return res.status(404).json({
        message: "Friend request not found or not authorized",
      });
    }

    // Update the status of the friend request
    friendReq.status = "accepted";
    await friendReq.save();

    // Create mutual friendship: both users are now friends
    await Friend.create([
      {
        user: req.user.id,
        friend: friendReq.user,
        status: "accepted",
      },
      {
        user: friendReq.friend,
        friend: req.user.id,
        status: "accepted",
      },
    ]);

    res.json({ message: "Friend request accepted" });
  } catch (err) {
    console.error("Error accepting friend request:", err);
    res.status(500).json({ error: "Error accepting friend request" });
  }
};

//Freinds List
const getFriends = async (req, res) => {
  try {
    // Fetch accepted and pending friend requests
    const friends = await Friend.find({
      $or: [{ user: req.user.id }, { friend: req.user.id }],
    })
      .populate("user", "username email") // Populate with user details if needed
      .populate("friend", "username email"); // Populate with friend details if needed

    // Filter out accepted friends
    const acceptedFriends = friends.filter(
      (friend) => friend.status === "accepted"
    );
    const pendingFriends = friends.filter(
      (friend) => friend.status === "pending"
    );

    res.render("friends_list", { acceptedFriends, pendingFriends }); // Passing friends data to Pug template
  } catch (err) {
    console.error("Error fetching friends list:", err);
    res.status(500).send("Error fetching friends list");
  }
};

//remove friend
const removeFriends = async (req, res) => {
  try {
    const { friendId } = req.params;

    // Find and delete the friend request from either direction and with "accepted" status
    const result = await Friend.findOneAndDelete({
      $or: [
        { user: req.user.id, friend: friendId },
        { user: friendId, friend: req.user.id },
      ],
      status: "accepted",
    });

    if (!result) {
      return res.status(404).json({
        message: "Friendship not found or not accepted",
      });
    }

    res.redirect("/api/friends"); // Redirect to the friends list after successful removal
  } catch (err) {
    console.error("Error removing friend:", err);
    res.status(500).json({ error: "Error removing friend" });
  }
};

module.exports = { sendFriendReq, acceptFriendReq, getFriends, removeFriends };
