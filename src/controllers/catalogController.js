const { collections, products } = require("../data/mockData");

const getCollections = (req, res) => {
  return res.status(200).json({
    data: collections,
  });
};

const getProducts = (req, res) => {
  return res.status(200).json({
    data: products,
  });
};

module.exports = {
  getCollections,
  getProducts,
};
