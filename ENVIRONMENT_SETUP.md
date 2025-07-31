# Environment Setup Guide

## Frontend Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=AIzaSyAEDIWIbuLkLN88WRXdWeorfKAygWax4oc
REACT_APP_FIREBASE_AUTH_DOMAIN=offers-5e23d.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=offers-5e23d
REACT_APP_FIREBASE_STORAGE_BUCKET=offers-5e23d.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=695731252828
REACT_APP_FIREBASE_APP_ID=1:695731252828:web:5f1ace19518f97882d0099
REACT_APP_FIREBASE_MEASUREMENT_ID=G-LF4L9FZPB0

# Stripe Configuration
REACT_APP_STRIPE_PUBLIC_KEY=pk_test_51QaUzSGPA4p9u1zTx16UgrB59rhKJ3YQxbvDiPwExaKUgZxFUP48gENlIgrfzrORe11HVfy63kuXMm6dvHkRUTvd00s327zhO9

# Frontend URL
REACT_APP_FRONTEND_URL=https://offers-5e23d.web.app
```

## Backend Environment Variables (Firebase Functions)

Set these using Firebase Functions config:

```bash
# Set Stripe secret key
firebase functions:config:set stripe.secret_key="sk_test_YOUR_STRIPE_SECRET_KEY"

# Set OpenAI API key
firebase functions:config:set openai.api_key="sk-YOUR_OPENAI_API_KEY"

# Set Stripe webhook secret
firebase functions:config:set stripe.webhook_secret="whsec_YOUR_WEBHOOK_SECRET"

# Set frontend URL
firebase functions:config:set app.frontend_url="https://offers-5e23d.web.app"
```

## Deployment

After setting up environment variables:

1. **Frontend**: `npm run build && firebase deploy --only hosting`
2. **Functions**: `firebase deploy --only functions`

## Security Notes

- Never commit `.env` files to git
- Use different keys for development and production
- Rotate keys regularly
- Monitor for unauthorized usage
