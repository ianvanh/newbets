const mongoose = require('mongoose');
const moment = require('moment-timezone');

const userSchema = new mongoose.Schema({
  phone: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  pass: { type: String, default: '' },
  premium: { type: Boolean, default: false },
  planStartDate: { type: Date, default: null },
  planEndDate: { type: Date, default: null }
});

userSchema.statics.count = async function () {
  return await this.countDocuments();
};

userSchema.statics.delUser = async function (phone) {
  await this.deleteOne({ phone });
};

userSchema.statics.show = async function (phone) {
  return await this.findOne({ phone });
};

userSchema.statics.check = async function (phone) {
  const user = await this.findOne({ phone });
  return !!user;
};

userSchema.statics.setPremium = async function (phone, durationDays = 30) {
  const user = await this.findOne({ phone });
  if (!user) throw new Error('Usuario no encontrado.');

  const now = moment().tz('America/Bogota');
  const end = now.clone().add(durationDays, 'days');

  user.premium = true;
  user.planStartDate = now.toDate();
  user.planEndDate = end.toDate();

  await user.save();
};

const User = mongoose.model('User', userSchema);
module.exports = User;