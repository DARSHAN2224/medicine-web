const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
   
    shopId: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shop',
     },  // Link to seller
    image:  {
        type: String,
    } // URL or local path to image
},{timestamps:true});



  
module.exports = mongoose.model('Product', productSchema);
