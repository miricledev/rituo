const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  groupId: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  leader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  activeChallenge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GroupChallenge'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Group', groupSchema); 