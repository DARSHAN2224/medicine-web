const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  image:String
},{timestamps:true});
module.exports = mongoose.model('Offer', offerSchema);
