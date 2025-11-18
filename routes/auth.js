const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Initialize Stripe (will be null if key not provided)
let stripe = null;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    console.log('✅ Stripe initialized successfully');
  } else {
    console.warn('⚠️  STRIPE_SECRET_KEY not found in environment variables');
  }
} catch (error) {
  console.error('❌ Failed to initialize Stripe:', error.message);
}

// Regular client for normal operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Admin client for admin operations (uses service role key)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Signup route
router.post('/signup', async (req, res) => {
    const {email, password, name, role} = req.body;
    if(!email || !password || !name){
        return res.status(400).json({ error: 'All fields are required'});
    }
    try{
        const userRole = role || 'learner';
        const {data, error} = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                  name, 
                  role: userRole,
                  // Instructors start with unpaid status
                  payment_status: userRole === 'instructor' ? 'pending' : 'completed',
                  payment_amount: userRole === 'instructor' ? 1500 : 0,
                  registration_date: new Date().toISOString()
                },
                emailRedirectTo: "http://localhost:5000/signIn.html"
            }    
        });
        if (error){
            return res.status(400).json({error: error.message});
        }
        res.json({
            message: 'User registered successfully',
            user: data.user
        });
    }
    catch (error){
        console.error('Signup error: ', error);
        res.status(500).json({error: 'server error'});
    }
});

// Login route - return token + role
router.post('/signin', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Extract role and payment status from metadata
    const token = data.session.access_token;
    const role = data.user?.user_metadata?.role || 'learner';
    const paymentStatus = data.user?.user_metadata?.payment_status;

    console.log('🔐 Sign-in successful for:', email);
    console.log('   Token extracted:', token ? 'YES (length: ' + token.length + ')' : 'NO - MISSING!');
    console.log('   Role:', role);
    console.log('   Payment Status:', paymentStatus);

    // Check if token was extracted
    if (!token) {
      console.error('❌ CRITICAL: No token in session!');
      console.error('   Session data:', data.session);
      return res.status(500).json({ error: 'Failed to extract authentication token' });
    }

    // Check if instructor has completed payment
    if (role === 'instructor' && paymentStatus !== 'completed') {
      console.log('⚠️  Instructor payment not completed, redirecting to payment page');
      return res.status(403).json({ 
        error: 'Payment required',
        message: 'Please complete your instructor registration payment to access your account.',
        paymentRequired: true,
        redirectUrl: `/instructorPayment.html?email=${encodeURIComponent(email)}&name=${encodeURIComponent(data.user?.user_metadata?.name || '')}&userId=${data.user.id}`
      });
    }

    console.log('✅ Returning token to client');
    res.json({
      message: 'Login successful',
      token: token,
      role: role,
      paymentStatus: paymentStatus
    });
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Redirect route (validates token & injects session data)
router.get('/redirect', async (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).send("No token provided");

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).send("Invalid or expired token");
    }

    const role = data.user.user_metadata?.role || 'learner';

    // Session data injected to frontend storage
    const sessionData = {
      user_id: data.user.id,
      user_email: data.user.email,
      email: data.user.email,
      user_role: role,
      role: role,
      supabase_token: token,
      token: token,  // Also store as 'token' for compatibility
      auth_token: token  // Also store as 'auth_token' for compatibility
    };

    let dashboardFile = role === 'instructor' 
      ? 'instructorDashboard.html' 
      : 'studentDashboard.html';

    // Inject into sessionStorage + redirect
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Redirecting...</title>
        <script>
          const sessionData = ${JSON.stringify(sessionData)};
          console.log('🔐 Storing session data:', Object.keys(sessionData));
          Object.keys(sessionData).forEach(key => {
            sessionStorage.setItem(key, sessionData[key]);
            console.log('✅ Stored:', key);
          });
          console.log('✅ All keys in sessionStorage:', Object.keys(sessionStorage));
          console.log('🔄 Redirecting to /${dashboardFile}');
          window.location.replace('/${dashboardFile}');
        </script>
      </head>
      <body>
        <p>Redirecting to your dashboard...</p>
      </body>
      </html>
    `);

  } catch (err) {
    console.error('Redirect error', err);
    res.status(500).send("Server error");
  }
});

// Create instructor payment session
router.post('/create-instructor-payment', async (req, res) => {
  const { email, name, userId, amount } = req.body;

  if (!email || !name || !amount) {
    return res.status(400).json({ error: 'Email, name, and amount are required' });
  }

  // Check if Stripe is initialized
  if (!stripe) {
    console.error('❌ Stripe not initialized - missing STRIPE_SECRET_KEY');
    return res.status(500).json({ 
      error: 'Payment system not configured. Please contact administrator.',
      details: 'Stripe secret key is missing from server configuration'
    });
  }

  try {
    console.log('📝 Creating Stripe session for instructor registration:', email);
    
    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'zar',
            product_data: {
              name: 'Instructor Registration Fee',
              description: 'One-time setup fee to become an instructor on LearnTrack',
              images: ['https://your-domain.com/instructor-icon.png'],
            },
            unit_amount: amount, // Amount in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/instructorPayment.html?session_id={CHECKOUT_SESSION_ID}&email=${encodeURIComponent(email)}&userId=${userId}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/instructorPayment.html?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&userId=${userId}`,
      customer_email: email,
      metadata: {
        userId: userId,
        userName: name,
        paymentType: 'instructor_registration'
      }
    });

    res.json({ 
      sessionId: session.id,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    });

  } catch (error) {
    console.error('Stripe session creation error:', error);
    res.status(500).json({ error: 'Failed to create payment session' });
  }
});

// Verify instructor payment route
router.post('/verify-instructor-payment', async (req, res) => {
  const { sessionId, email, userId } = req.body;

  if (!sessionId || !email) {
    return res.status(400).json({ error: 'Session ID and email are required' });
  }

  try {
    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return res.status(400).json({ error: 'Payment session not found' });
    }

    // Check if payment was successful
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ 
        error: 'Payment was not successful',
        status: session.payment_status
      });
    }

    // Check if amount matches (R 1,500 = 150000 cents)
    if (session.amount_total < 150000) {
      return res.status(400).json({ 
        error: 'Payment amount is incorrect'
      });
    }

    // Update user metadata to mark payment as completed
    // Use admin client for admin operations
    const { data: users, error: fetchError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (fetchError) {
      console.error('Error fetching users:', fetchError);
      return res.status(500).json({ error: 'Failed to update payment status', details: fetchError.message });
    }

    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('📝 Updating user payment status for:', email);

    // Update user metadata with payment info
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...user.user_metadata,
          payment_status: 'completed',
          payment_date: new Date().toISOString(),
          payment_reference: sessionId,
          payment_amount: 1500,
          stripe_payment_intent: session.payment_intent
        }
      }
    );

    if (updateError) {
      console.error('Error updating user:', updateError);
      return res.status(500).json({ error: 'Failed to update payment status', details: updateError.message });
    }

    console.log('✅ Payment status updated successfully for:', email);

    res.json({ 
      success: true,
      message: 'Payment verified and account activated',
      user: updatedUser.user
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: 'Server error during payment verification' });
  }
});

module.exports = router;