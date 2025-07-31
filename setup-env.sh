#!/bin/bash

echo "Setting up Firebase Functions environment variables..."
echo "Please provide the following values:"
echo ""

# Get current values
echo "Current Firebase Functions config:"
firebase functions:config:get

echo ""
echo "To set environment variables, use:"
echo "firebase functions:config:set stripe.secret_key=\"YOUR_STRIPE_SECRET_KEY\""
echo "firebase functions:config:set openai.api_key=\"YOUR_OPENAI_API_KEY\""
echo "firebase functions:config:set stripe.webhook_secret=\"YOUR_WEBHOOK_SECRET\""
echo "firebase functions:config:set app.frontend_url=\"https://offers-5e23d.web.app\""

echo ""
echo "Example:"
echo "firebase functions:config:set stripe.secret_key=\"sk_test_...\""
echo ""
echo "After setting config, deploy functions with:"
echo "firebase deploy --only functions"
