export const environment = {
  production: false,
  firebase: {
    apiKey: "AIzaSyBBo66ZTXf74r-zBIHf5uq0suXftnHKvRo",
    authDomain: "theluxmining-91ab1.firebaseapp.com",
    projectId: "theluxmining-91ab1",
    storageBucket: "theluxmining-91ab1.firebasestorage.app",
    messagingSenderId: "28140566611",
    appId: "1:28140566611:web:14f73bcbf1dc43eac9aea6",
    measurementId: "G-L3NM33F382"
  },
  stripe: {
    // TEST MODE - Use Stripe test keys (pk_test_...)
    // Get your test keys from: https://dashboard.stripe.com/test/apikeys
    publishableKey: 'pk_test_51SIbUgJhHEcCQBgB11y69LG7vPrQBYipNgsjNR9fMD9i4ckCX0pPPRc4wowgdDQnGKjUkfjnkOamBj1Jw06DWYq1001YVRKi1r'
  },
  recaptcha: {
    // Get your site key from: https://www.google.com/recaptcha/admin
    // Use reCAPTCHA v3 for invisible verification
    // NOTE: For local development you can use the official Google test key below
    // which works on localhost. Replace with your production key for deployment.
    siteKey: '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'
  },
  useEmulators: true // Use Firebase emulators for local development
};
