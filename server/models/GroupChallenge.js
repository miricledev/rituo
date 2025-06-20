const mongoose = require('mongoose');

const groupChallengeSchema = new mongoose.Schema({
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  memberHabits: [{
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    habits: [{
      name: {
        type: String,
        required: true
      },
      description: String,
      frequency: {
        type: String,
        enum: ['daily', 'weekly'],
        default: 'daily'
      },
      progress: [{
        date: Date,
        completed: Boolean,
        notes: String
      }]
    }]
  }],
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('GroupChallenge', groupChallengeSchema); 