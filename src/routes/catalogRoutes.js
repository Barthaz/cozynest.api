const express = require("express");
const {
  getCollections,
  getProducts,
} = require("../controllers/catalogController");

const router = express.Router();

router.get("/collections", getCollections);
router.get("/products", getProducts);

module.exports = router;
