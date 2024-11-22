const { validationResult } = require("express-validator");
const Seller = require("../../models/userModel");
const product = require("../../models/productsModel");
const Shop = require("../../models/shopModel");
const offer = require("../../models/offersModel");
const bcrypt = require("bcrypt");
const fs = require('fs');
const path = require('path');
// const mongoose = require('mongoose');


const { sendVerifyMail } = require("../../helpers/mailer");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../../helpers/generateToken");
// const randomstring = require("randomstring");

const securePassword = async (password) => {
  try {
    return await bcrypt.hash(password, 10);
  } catch (error) {
    console.log(error.message);
    res.redirect("/seller/signup");
  }
};

const loadRegister = async (req, res) => {
  try {
    const msg = req.flash('msg');
    res.status(200).render("seller/signup",{ csrfToken: req.csrfToken(),msg});
  } catch (error) {
    console.log(error.message);
    req.flash('msg',error.message);
    res.redirect("/seller/signup");
  }
};

const signupSeller = async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      console.log(errors.array());
      const msg = errors.array()[0].msg;
      console.log(msg);
      return res.render("seller/signup", { msg });
    }

    const { name, email, mno, password } = req.body;
    const isExistUser = await Seller.findOne({ email });

    if (isExistUser) {
      req.flash("msg", "Email already exists!");
     return res.status(200).redirect("/seller/signup");
    }
    const hashedPassword = await securePassword(password);
    const seller = new Seller({
      name,
      email,
      mobile: mno,
      password: hashedPassword,
    });
    const sellerData = await seller.save();
    sendVerifyMail(name, email, sellerData._id);
    res.status(200).render("seller/login", {
      msg: "Registered successfully!, Please verify your email",
    });
  } catch (error) {
    console.log(error.message);
    res.redirect("/seller/signup");
  }
};



const loadLogin=async (req,res) => {
  try {
    const msg = req.flash('msg');
    const sellerData=req.flash('sellerData')[0];
    res.status(200).render('seller/login', { csrfToken: req.csrfToken(), msg,sellerData});
} catch (error) {
  console.log("nice 7",error.message);   
   res.redirect('/seller/login');
}
}

const  loadSellerForm=async (req,res) => {
  const msg = req.flash('msg');
  const sellerId=req.session.user._id
 return res.render('seller/sellerSignup', {msg,sellerId});
}


const loginSeller = async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log(errors.array());
        return res.render('seller/login',{ msg: errors.array()[0].msg });
    }

    const { email, password } = req.body;
    const sellerData = await Seller.findOne({ email });

    if (!sellerData) {
        req.flash("msg", "Email and password is incorrect!");
        return res.redirect('/seller/login');
    }
    
    const isPassword = await bcrypt.compare(password, sellerData.password);
    if (!isPassword) {
        req.flash("msg", "Email and password is incorrect!");
        return res.redirect('/seller/login');
    }

    if (sellerData.is_verified === "0") {
        req.flash("msg", "Please verify the email!");
        req.flash("sellerData", sellerData);
        return res.redirect('/seller/login');
    }

    
    // Generate tokens (Assuming you have token generation logic)
    const accessToken = await generateAccessToken({ user: sellerData.email });
    const refreshToken = await generateRefreshToken({ user: sellerData.email });

    // Update user with refresh token
    await Seller.updateOne({ email }, { $set: { refreshToken: refreshToken } });

    // Set cookies
    res.cookie('sellerrefreshToken', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        maxAge: 7200000 
    });
    res.cookie('sellertoken', accessToken, { maxAge: 60000 });
    req.flash("msg", "hello!");
    
  const shopData = await Shop.findOne({ sellerId:sellerData._id });
  if (!shopData || !shopData.is_filled) {
    return res.redirect('/seller/shopForm');
  }
  req.session.shopData = shopData;
  res.cookie('shopData', shopData, { maxAge: 7200000 });
    return res.redirect('/seller/home');
} catch (error) {
  console.log("nice 8",error.message);
      return res.redirect('/seller/login');
}
};


const userLogout = async (req, res) => {
    try {
      const { _id } =   req.session.user
      await Seller.findByIdAndUpdate(
        { _id },
        {
          $set: {
            refreshToken: "", // this removes the field from document
          },
        },
        {
          new: true,
        }
      );
      const options = {
        httpOnly: true,
        secure: true,
      };
      req.session.destroy();
      return res
        .status(200)
        .clearCookie("sellertoken")
        .clearCookie("shopData")
        .clearCookie("sellerrefreshToken", options)
        .redirect("/seller/login");
    } catch (error) {
      console.log("nice 9",error.message);    }
  };
  

const SellerForm=async (req,res) => {
  const { name, description, sellerId } = req.body;

  try {
    // Find the seller by their ID
    // let shopData = await Seller.findOne({_id: sellerId });
      // If shop data doesn't exist, create new data
      let image;
      if (req.file) {
        image = req.file.filename;
      }
      // console.log(req.file.filename);
      
     const  shopData = new Shop({
        image,
        sellerId,
        name,
        description,
        is_filled: 1 // Set this to 1 after filling the form
      });
      // console.log(shopData);
  
    await shopData.save();
    // Save the updated shop data
    res.cookie('shopData', shopData, { maxAge: 7200000 });
    req.session.shopData = shopData;
    // Redirect to the seller home page after saving
    return res.redirect('/seller/home');
  } catch (error) {
    console.error('Error updating shop details:', error);
    res.redirect('/seller/shopForm');
  }
}

const loadHome=async (req, res) => {
  try {
    // const {_id}=req.user;
    const shop = req.cookies.shopData||req.session.shopData;   
    const productCount= await product.countDocuments({shopId:shop._id});
    const offerCount= await offer.countDocuments({shopId:shop._id});
   
    const msg1 = req.flash('msg');
    res.render('seller/home',{msg1,productCount,offerCount,shop});
  } catch (error) {
    console.log("nice 10",error.message);  }
 
}




// loading products page
const loadProducts=async (req,res) => {
  try {
    // const {_id}=req.user
    // console.log(_id);
    // const shops=await Shop.findOne({sellerId:_id});
    const shop=req.session.shopData || req.cookies.shopData
    console.log("shop data",shop._id);
    const products=await product.find({shopId:shop._id})
    console.log(products);
    
    res.render('seller/products/products',{products,shop});
  } catch (error) {
    console.log("nice1 ",error.message);  }
}

// loading  add product page
const loadAddProducts=async (req,res) => {
  try {
    // const user=req.user
    // const shop=await Shop.findOne({sellerId:user._id});
    const shop= req.session.shopData|| req.cookies.shopData
    // console.log(shop);
    
    const { success, msg } = req.query;
    // console.log("load user ",user);
    res.render('seller/products/addproducts',{shop,success,msg});
  } catch (error) {
    console.log("nice 2",error.message);  }
}

// loading offers page
const loadOffers=async (req,res) => {
  try {
    // const {_id}=req.user
    // console.log(_id);
    const shop=req.session.shopData|| req.cookies.shopData

    const offers=await offer.find({shopId:shop._id});
    // console.log(products);
    res.render('seller/products/offers',{offers,shop});
  } catch (error) {
    console.log("nice3 ",error.message);  }
}

// loading add offers page
const loadAddOffers=async (req,res) => {
  try {
    // const user=req.user
    const shop= req.session.shopData|| req.cookies.shopData

    // const shop=await Shop.find({offer:shops});
    const { msg } = req.query;
    res.render('seller/products/addoffers',{shop,msg});
  } catch (error) {
    console.log("nice4 ",error.message);  }
}



const addProducts = async (req, res) => {
  try {
    const { name, description,  shopId } = req.body;
    // console.log(shopId);
    


    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(400).redirect(`/seller/addproducts?success=false&msg=Shop%20not%20found`);
    }
    // console.log("shop",shop);
    
    const isExists = await product.findOne({
      name: { $regex:`^${name}$`, $options: 'i' }
    });
    // console.log("product",isExists);

    if (isExists) {
      return res.status(400).redirect(`/seller/addproducts?success=false&msg=Product%20Name%20already%20exists`);
    }

    let image;
    if (req.file) {
      image = req.file.filename;
    }

    const newProduct = new product({
      name,
      description,
      image,
      shopId
    });
    // console.log(newProduct);
    
    const savedProduct = await newProduct.save();

    // Add product to the shop
    shop.productId.push(savedProduct._id);
    await shop.save();

    req.flash("success", true);
    req.flash("msg", 'Product added!');
    return res.status(200).redirect("/seller/products");
  } catch (error) {
    return res.status(400).json({
      success: false,
      msg: error.message
    });
  }
};


const loadEditProducts= async (req,res) => {
  try {
    const { id } = req.query;
   
    const productData = await product.findOne({_id:id})
    if(!productData){
      req.flash("msg", 'Product does not exist!');
      return res.status(200).redirect("/seller/editproducts")
    }
    // console.log("load user ",user);
    const msg = req.flash('msg');
    res.render('seller/products/editProduct',{shop:productData,msg});
  } catch (error) {
    console.log("nice6 ",error.message);  }
}



const editProducts = async (req, res) => {
  try {
    
    const { id, name, description } = req.body;
    

    let updateObj = {
      name,
      description,
    };

    if (req.file) {
      updateObj.image = req.file.filename;
    }
    // Update product with new details
    const updatedProduct = await product.findByIdAndUpdate({_id:id}, { $set: updateObj }, { new: true })
    req.flash("msg", 'Product updated!');
    return res.status(200).redirect("/seller/products");
  } catch (error) {
    return res.status(400).json({
      success: false,
      msg: error.message
    });
  }
};

const deleteProducts = async (req, res) => {
  try {
    const productData = await product.findOne({ _id: req.params.id });

    if (!productData) {
      return res.status(400).json({
        success: false,
        msg: 'Product not found'
      });
    }

    // Remove product image if exists
    if (productData.image) {
      const oldImagePath = path.join(__dirname, '../../public/Productimages', productData.image);
      if (fs.existsSync(oldImagePath)) {
        await fs.promises.unlink(oldImagePath);
      }
    }

    // Remove product from the shop
    await Shop.findByIdAndUpdate(productData.shopId, { $pull: { productId: productData._id } });

    // Delete the product
    await product.deleteOne({ _id: req.params.id });

    req.flash('success', 'Product deleted successfully');
    res.redirect('/seller/products/');
  } catch (error) {
    return res.status(400).json({
      success: false,
      msg: error.message
    });
  }
};



const addOffers = async (req, res) => {
  try {
    const { shopId} = req.body;
    let image
     if (req.file) {
       image=req.file.filename
     }

      var obj = {
          image,
          shopId
      }
    
      const offers = new offer(obj)

      await offers.save();
      req.flash("msg", 'Product added!');
      return res.status(200).redirect("/seller/offers")
  }
  catch (error) {
      return res.status(400).json({
          sucess: false,
          msg: error.message
      })
  }
}

const  deleteOffers =async (req,res) => {
  try {
    const productData=await offer.findOne({_id:req.params.id})
    // console.log(productData.image);
    if (productData.image) {
      const oldImagePath = path.join(__dirname, '../../public/Productimages',productData.image);
    // console.log(oldImagePath);
    if (fs.existsSync(oldImagePath)) {
      await fs.promises.unlink(oldImagePath);
      console.log('Old image deleted successfully');
    }
   }
  //  console.log("jii ",req.params.id);
   
   await offer.deleteOne({_id:req.params.id})
   req.flash('sucess', 'Your Data has been Sucessfully Deleted')
   res.redirect('/seller/offers/')
  } catch (error) {
      return res.status(400).json({
        sucess: false,
        msg: error.message
    })
  }
}






const loadEditProfile=async (req, res) => {
  try {
    const shop = req.session.shopData || req.cookies.shopData;
   // Get user ID from session
   const sellerId=req.session.user._id
      const user = await Shop.findById(shop._id); // Fetch user from the database

      if (!user) {
          return res.status(404).send('User not found');
      }

      res.render('seller/loadEditShop', { user ,sellerId}); // Render the edit profile EJS template with user data
  } catch (error) {
      console.error('Error fetching user for edit:', error);
      res.status(500).send('Internal Server Error');
  }
}


const updateEditProfile=async (req, res) => {
  const { name, description,sellerId } = req.body; // Extract user data from request

  try {
    const shop = req.session.shopData || req.cookies.shopData;// Get user ID from session
      const user = await Shop.findById(shop._id); // Fetch user from the database

      if (!user) {
          return res.status(404).send('User not found');
      }

      let images;
      if (req.file) {
        images = req.file.filename;
        user.image=images
      }


      // Update user fields
      user.name = name;
      user.description = description; 
      user.sellerId=   sellerId
      
      await user.save(); // Save updated user to the database
      
      // Optionally, update the session user data
      res.cookie('shopData', user, { maxAge: 7200000 });
      req.session.shopData = user;

      res.redirect('/seller/home'); // Redirect back to the profile page after successful update
  } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).send('Internal Server Error');
  }
}


module.exports={
  loadRegister,
  signupSeller,
    loadLogin,
    loginSeller,
    userLogout,
    loadHome,
    loadProducts,
    loadAddProducts,
    loadOffers,
    loadAddOffers,
    addProducts,
    loadEditProducts,
    editProducts,
    deleteProducts,
    addOffers,
    deleteOffers,
    SellerForm,
    loadSellerForm,
    loadEditProfile,
  updateEditProfile,
  

    
}