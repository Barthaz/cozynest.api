const getCollections = (req, res) => {
  return res.status(200).json({
    data: [],
  });
};

const getProducts = (req, res) => {
  return res.status(200).json({
    data: [],
  });
};

module.exports = {
  getCollections,
  getProducts,
};
