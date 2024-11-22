const { validationResult } = require("express-validator");
const User = require("../models/userModel");
const Offer = require("../models/offersModel");
const Shop = require("../models/shopModel");
const Product = require("../models/productsModel");



const bcrypt = require("bcrypt");
const { sendVerifyMail, sendResetPasswordMail } = require("../helpers/mailer");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../helpers/generateToken");
const randomstring = require("randomstring");



// seccure password function
const securePassword = async (password) => {
  try {
    return await bcrypt.hash(password, 10);
  } catch (error) {
    console.log(error.message);
    res.redirect("/");
  }
};

// loading the user login page
const loadlogin = async (req, res) => {
  try {
    const msg = req.flash('msg');
    const userData = req.flash('userData')[0];
    res.status(200).render('user/login', { csrfToken: req.csrfToken(), msg, userData });
  } catch (error) {
    console.log(error.message);
    res.redirect('/login');
  }
};
// loading the user signup page
const loadRegister = async (req, res) => {
  try {
    const msg = req.flash('msg');
    res.status(200).render("user/signup", { csrfToken: req.csrfToken(), msg });
  } catch (error) {
    console.log(error.message);
    res.redirect("/signup");
  }
};

//working og the user signup page
const signupUser = async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      console.log(errors.array());
      const msg = errors.array()[0].msg;
      console.log(msg);
      return res.render("user/signup", { msg });
    }

    const { name, email, mno, password } = req.body;
    const isExistUser = await User.findOne({ email });

    if (isExistUser) {
      req.flash("msg", "Email already exists!");
      return res.status(200).redirect("/signup");
    }
    const hashedPassword = await securePassword(password);
    const user = new User({
      name,
      email,
      mobile: mno,
      password: hashedPassword,
    });
    const userData = await user.save();
    sendVerifyMail(name, email, userData._id);
    res.status(200).render("user/login", {
      msg: "Registered successfully!, Please verify your email",
    });
  } catch (error) {
    console.log(error.message);
    res.render("/signup");
  }
};

// verify the email after signup
const verifyEmail = async (req, res) => {
  try {
    verifiedData = await User.updateOne(
      { _id: req.query.id },
      { $set: { is_verified: 1 } }
    );
    res.status(200).render("user/verify-email", {
      msg: "email is verified",
    });
  } catch (error) {
    console.log(error.message);
    res.redirect("/signup");
  }
};

// user login
const loginUser = async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('user/login', { msg: errors.array()[0].msg });
    }

    const { email, password } = req.body;
    const userData = await User.findOne({ email });

    if (!userData) {
      req.flash("msg", "Email and password is incorrect!");
      return res.redirect('/login');
    }

    const isPassword = await bcrypt.compare(password, userData.password);
    if (!isPassword) {
      req.flash("msg", "Email and password is incorrect!");
      return res.redirect('/login');
    }

    if (userData.is_verified === "0") {
      req.flash("msg", "Please verify the email!");
      req.flash("userData", userData);
      return res.redirect('/login');
    }
    if (userData.role != 'user') {
      req.flash("msg", 'You do not have permission to access this route!');
      return res.redirect('/login');
    }
    // Generate tokens (Assuming you have token generation logic)
    const accessToken = await generateAccessToken({ user: userData.email });
    const refreshToken = await generateRefreshToken({ user: userData.email });

    // Update user with refresh token
    await User.updateOne({ email }, { $set: { refreshToken: refreshToken } });

    // Set cookies
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      maxAge: 7200000
    });
    res.cookie('token', accessToken, { maxAge: 60000 });
    req.flash("msg", "hello!");
    // Redirect to home
    res.redirect('/home');
  } catch (error) {
    console.log(error.message);
    res.redirect('/login');
  }
};

// for the token refresh

const forgetLoad = async (req, res) => {
  try {
    const msg = req.flash('msg')
    res.render("user/forget", { msg });
  } catch (error) {
    console.log(error.message);
  }
};



const forgetVerify = async (req, res) => {
  try {
    const errors = validationResult(req);
    const { email } = req.body;

    const userData = await User.findOne({ email });
    if (!errors.isEmpty()) {
      console.log(errors.array());
      req.flash('msg', errors[0].msg)
      return res.redirect("/forget");
    }
    if (userData) {
      // console.log(userData,userData.is_verified);
      if (userData.is_verified === '0') {
        req.flash("msg", "Please verify the email!");
        req.flash("userData", userData);
        if (userData.role == 'seller')
          return res.redirect('/seller/login');
        if (userData.role == 'admin')
          return res.redirect('/admin/login');
        return res.redirect('/login');
      } else {
        const randomString = randomstring.generate();
        const updatedData = await User.updateOne(
          { email },
          { $set: { token: randomString } }
        );
        console.log(updatedData);

        sendResetPasswordMail(userData.name, userData.email, randomString);
        req.flash("msg", "please check your mail to reset your password")
        if (userData.role == 'seller')
          return res.redirect('/seller/login');
        if (userData.role == 'admin')
          return res.redirect('/admin/login');
        return res.redirect('/login');
      }
    } else {
      res.render("user/forget", { mes: "User email is incorrect" });
    }
  } catch (error) {
    console.log(error.message);
  }
};



const forgetPasswordLoad = async (req, res) => {
  try {
    const token = req.query.token;
    const tokenData = await User.findOne({ token });
    if (tokenData) {
      res.render("user/forget-password", { user_id: tokenData._id });
    } else {
      res.render("user/404", { mes: "token is not found" });
    }
  } catch (error) {
    console.log(error.message);
  }
};




const resetPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    const { email } = req.body;

    const userData = await User.findOne({ email });
    if (!errors.isEmpty()) {
      console.log(errors.array());

      return res.redirect("/forget-password");
    }
    const { user_id, password } = req.body;
    const sercure_password = await securePassword(password);
    const updatedData = await User.findByIdAndUpdate(
      { _id: user_id },
      { $set: { password: sercure_password, token: "" } }
    );
    if (userData.role == 'seller')
      return res.redirect('/seller/login');
    if (userData.role == 'admin')
      return res.redirect('/admin/login');
    return res.redirect('/login');
  } catch (error) {
    console.log(error.message);
  }
};



const verificationLoad = async (req, res) => {
  try {
    res.render("user/verification");
  } catch (error) {
    console.log(error.message);
  }
};



const sendverification = async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      console.log(errors.array());
      return res.render("user/verification", { msg: errors[0].msg });
    }
    const { email } = req.body;
    const userData = await User.findOne({ email });
    if (userData) {
      sendVerifyMail(userData.name, userData.email, userData._id);
      res.render("user/verification", { mes: "check your mail to verify" });
    } else {
      res.render("user/verification", { mes: "email does not exist" });
    }
  } catch (error) {
    console.log(error.message);
  }
};

const userLogout = async (req, res) => {
  try {
    const { _id } = req.user;
    await User.findByIdAndUpdate(
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
      .clearCookie("token")
      .clearCookie("refreshToken", options)
      .redirect("/login");
  } catch (error) {
    console.log(error.message);
  }
};



const loadHome = async (req, res) => {
  const user = req.user;
  const offers = await Offer.find();
  const shops = await Shop.find({});
  const msg1 = req.flash('msg');
  res.render('home', { msg1, offers, shops, user });
}


const loadSellerShop = async (req, res) => {
  let { search, page, sort } = req.query;
  page = page || 1;
  const limit = 6; // Products per page
  const skip = (page - 1) * limit;
  const shopId = req.params.id;



  // Fetch the shop and populate the products
  const shops = await Shop.findOne({ _id: shopId }).populate({
    path: 'productId',
    match: search
      ? { name: { $regex: '.*' + search + '.*', $options: 'i' } }
      : {}, // Apply search on product name if provided
    options: { sort: sortOptions, skip, limit }, // Apply sort, pagination
  }).exec();

  // Total products after applying search query
  const totalProducts = await Shop.countDocuments({ _id: shopId }).populate({
    path: 'productId',
    match: search
      ? { name: { $regex: '.*' + search + '.*', $options: 'i' } }
      : {}, // Apply search on product name if provided
    options: { sort: sortOptions, skip, limit }, // Apply sort, pagination
  }).exec();

  const totalPages = Math.ceil(totalProducts / limit);

  // Get flash message if present
  const msg1 = req.flash('msg');

  res.render('menu', {
    msg1,
    shops, // Pass the shop along with populated products
    currentPage: parseInt(page),
    totalPages,
    search,
    sort,
  });
};




const loadShop = async (req, res) => {

  let { search, page, sort } = req.query;
  page = page || 1;
  const limit = 6; // Products per page
  const skip = (page - 1) * limit;

  let query = {};
  if (search) {
    query = { name: { $regex: '.*' + search + '.*', $options: 'i' } }; // Case-insensitive search
  }

  // Sorting logic
  let sortOptions = {};
  if (sort === 'price_asc') {
    sortOptions = { price: 1 }; // Sort by price ascending
  } else if (sort === 'price_desc') {
    sortOptions = { price: -1 }; // Sort by price descending
  } else if (sort === 'discount_asc') {
    sortOptions = { discount: 1 }; // Sort by discount ascending
  } else if (sort === 'discount_desc') {
    sortOptions = { discount: -1 }; // Sort by discount descending
  }


  const shops = await Product.find(query).populate('shopId').sort(sortOptions).skip(skip).limit(limit).exec();
  const totalProducts = await Product.countDocuments(query).populate('shopId').exec();
  const totalPages = Math.ceil(totalProducts / limit);


  const msg1 = req.flash('msg');


  res.render('shops', {
    msg1,
    shops,
    currentPage: parseInt(page),
    totalPages,
    search,
    sort,
  });

}


const searchSuggest = async (req, res) => {
  const { term, shopId } = req.query; // Get the search term and shopId from the query parameters

  // If either term or shopId is missing, return an empty array
  if (!term) {
    return res.json([]);
  }

  try {
    if (shopId) {
      const suggestions = await Product.find(
        {
          name: { $regex: term, $options: 'i' }, // Case-insensitive match for product names
          shopId: shopId // Ensure that the product belongs to the specified shop
        },
        { name: 1 } // Return only the product name
      ).limit(10);

      return res.json(suggestions.map(product => product.name));
    }
    // Fetch suggestions by searching for products with matching names in the specific shop
    const suggestions = await Product.find(
      { name: { $regex: term, $options: 'i' } }, // Case-insensitive match
      { name: 1 } // Return only the name field
    ).limit(10); // Limit the number of suggestions

    // Respond with the list of product names as suggestions
    res.json(suggestions.map(product => product.name));
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    res.status(500).send('Internal Server Error');
  }
}



const viewProfile = async (req, res) => {
  try {
    const userId = req.session.user._id; // Get user ID from session
    const user = await User.findById(userId); // Fetch user from the database

    if (!user) {
      return res.status(404).send('User not found');
    }

    res.render('viewProfile', { user }); // Render the profile EJS template with user data
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).send('Internal Server Error');
  }
};


const loadEditProfile = async (req, res) => {
  try {
    const userId = req.session.user._id; // Get user ID from session
    const user = await User.findById(userId); // Fetch user from the database

    if (!user) {
      return res.status(404).send('User not found');
    }

    res.render('editProfile', { user }); // Render the edit profile EJS template with user data
  } catch (error) {
    console.error('Error fetching user for edit:', error);
    res.status(500).send('Internal Server Error');
  }
}

const updateEditProfile = async (req, res) => {
  const { name, email, mobile, password } = req.body; // Extract user data from request

  try {
    const userId = req.session.user._id; // Get user ID from session
    const user = await User.findById(userId); // Fetch user from the database

    if (!user) {
      return res.status(404).send('User not found');
    }

    // Update user fields
    user.name = name;
    user.email = email;
    user.mobile = mobile;
    const hashedPassword = await securePassword(password);
    // Update password only if provided
    if (password) {
      user.password = hashedPassword; // You should hash the password before saving
    }

    await user.save(); // Save updated user to the database

    // Optionally, update the session user data
    req.session.user = user;

    res.redirect('/viewProfile'); // Redirect back to the profile page after successful update
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).send('Internal Server Error');
  }
}

module.exports = {
  signupUser,
  loadRegister,
  verifyEmail,
  loginUser,
  loadlogin,
  forgetLoad,
  forgetVerify,
  forgetPasswordLoad,
  sendverification,
  verificationLoad,
  resetPassword,
  userLogout,
  loadHome,
  loadSellerShop,
  loadShop,
  searchSuggest,
  viewProfile,
  loadEditProfile,
  updateEditProfile
};
