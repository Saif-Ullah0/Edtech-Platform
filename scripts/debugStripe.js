// backend/scripts/debugStripe.js

// Load environment variables first
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function debugStripeSettings() {
  try {
    console.log('🔍 Debugging Stripe Settings\n');

    // Check if Stripe key is loaded
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('❌ STRIPE_SECRET_KEY not found in environment variables');
      return;
    }

    console.log(`🔑 Stripe Key: ${process.env.STRIPE_SECRET_KEY.substring(0, 20)}...`);

    // 1. Check Stripe account
    const account = await stripe.accounts.retrieve();
    console.log(`📊 Stripe Account:`);
    console.log(`   ID: ${account.id}`);
    console.log(`   Country: ${account.country}`);
    console.log(`   Default Currency: ${account.default_currency}`);
    console.log(`   Charges Enabled: ${account.charges_enabled}`);

    // 2. Check recent payments
    console.log('\n💳 Recent Payments:');
    const payments = await stripe.paymentIntents.list({ limit: 5 });
    
    if (payments.data.length === 0) {
      console.log('   No payments found');
    } else {
      payments.data.forEach(payment => {
        console.log(`   ${payment.id}:`);
        console.log(`     Amount: ${payment.amount} ${payment.currency.toUpperCase()}`);
        console.log(`     USD Amount: ${payment.amount / 100}`);
        console.log(`     Status: ${payment.status}`);
        console.log(`     Created: ${new Date(payment.created * 1000)}`);
        console.log(`     Metadata:`, payment.metadata);
        console.log('');
      });
    }

    // 3. Test payment intent creation
    console.log('🧪 Testing Payment Intent Creation:');
    const testAmount = 29999; // $299.99 in cents
    
    const testPayment = await stripe.paymentIntents.create({
      amount: testAmount,
      currency: 'usd',
      metadata: {
        test: 'true',
        originalAmount: '299.99',
        currency: 'USD'
      }
    });

    console.log(`   Created: ${testPayment.id}`);
    console.log(`   Amount: ${testPayment.amount} cents`);
    console.log(`   Currency: ${testPayment.currency}`);
    console.log(`   USD Value: ${testPayment.amount / 100}`);

    // Cancel the test payment
    await stripe.paymentIntents.cancel(testPayment.id);
    console.log(`   Test payment cancelled`);

    // 4. Check environment variables
    console.log('\n⚙️ Environment Check:');
    console.log(`   STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? 'Set' : 'Missing'}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'Not set'}`);
    console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'Set' : 'Missing'}`);
    
    // Check for any currency-related env vars
    const currencyVars = [];
    Object.keys(process.env).forEach(key => {
      if (key.toLowerCase().includes('currency') || 
          key.toLowerCase().includes('rate') || 
          key.toLowerCase().includes('pkr')) {
        currencyVars.push(`${key}: ${process.env[key]}`);
      }
    });

    if (currencyVars.length > 0) {
      console.log('\n⚠️ Currency-related environment variables found:');
      currencyVars.forEach(variable => console.log(`   ${variable}`));
    } else {
      console.log('\n✅ No problematic currency variables found');
    }

  } catch (error) {
    console.error('❌ Stripe debug failed:', error.message);
    
    if (error.type === 'StripeAuthenticationError') {
      console.log('🔑 Check your STRIPE_SECRET_KEY in .env file');
      console.log(`Current key: ${process.env.STRIPE_SECRET_KEY?.substring(0, 20)}...`);
    }
  }
}

debugStripeSettings();