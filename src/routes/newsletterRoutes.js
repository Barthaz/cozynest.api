const express = require("express");
const {
  subscribeToNewsletter,
  sendTestNewsletterEmail,
} = require("../controllers/newsletterController");

const router = express.Router();

router.post("/newsletter/subscribe", subscribeToNewsletter);
router.get("/newsletter/send-test-email", sendTestNewsletterEmail);

module.exports = router;
