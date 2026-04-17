const collectionModel = require("../models/collectionModel");
const productModel = require("../models/productModel");

const getCollections = async (req, res) => {
  try {
    const collections = await collectionModel.findAll();

    return res.status(200).json({
      data: collections,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch collections.",
      details: error?.message || "Unknown collections error.",
    });
  }
};

const getProducts = async (req, res) => {
  try {
    const products = await productModel.findAll();

    return res.status(200).json({
      data: products,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch products.",
      details: error?.message || "Unknown products error.",
    });
  }
};

module.exports = {
  getCollections,
  getProducts,
};
