const mongoose = require('mongoose');

const SignalSchema = new mongoose.Schema({
  component_id: String,
  severity: String,
  payload: Object,
  received_at: { type: Date, default: Date.now },
  incident_id: String // Links to Postgres UUID
});

module.exports = mongoose.model('Signal', SignalSchema);
