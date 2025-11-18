const express = require('express');
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// POST /api/payments/create-checkout-session - Create Stripe checkout for a course
router.post('/create-checkout-session', async (req, res, next) => {
  try {
    const { courseId } = req.body;
    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }

    const token = req.headers?.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) return res.status(401).json({ error: 'Invalid token' });
    const user = userData.user;

    // Get course details
    const { data: course, error: cErr } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (cErr) throw cErr;
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Check if already enrolled and paid
    const { data: existing } = await supabase
      .from('enrollments')
      .select('*')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .single();

    if (existing && existing.purchased) {
      return res.status(400).json({ error: 'Already enrolled in this course' });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: course.title,
              description: course.description || '',
              images: course.thumbnail_url ? [course.thumbnail_url] : [],
            },
            unit_amount: course.price_cents || 0, // Price in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/payment-success.html?session_id={CHECKOUT_SESSION_ID}&course_id=${courseId}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/courseDetail.html?id=${courseId}`,
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: {
        course_id: courseId,
        user_id: user.id,
      },
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('Checkout session error:', err);
    next(err);
  }
});

// POST /api/payments/verify - Verify payment and create enrollment
router.post('/verify', async (req, res, next) => {
  try {
    const { sessionId, courseId } = req.body;
    if (!sessionId || !courseId) {
      return res.status(400).json({ error: 'sessionId and courseId are required' });
    }

    const token = req.headers?.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) return res.status(401).json({ error: 'Invalid token' });
    const user = userData.user;

    // Verify payment with Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    if (session.metadata.user_id !== user.id || session.metadata.course_id !== courseId) {
      return res.status(403).json({ error: 'Session mismatch' });
    }

    // Create or update enrollment with purchased flag
    const { data: enrollment, error: eErr } = await supabase
      .from('enrollments')
      .upsert(
        {
          user_id: user.id,
          course_id: courseId,
          purchased: true,
          payment_session_id: sessionId,
          payment_amount: session.amount_total,
        },
        { onConflict: 'user_id,course_id' }
      )
      .select()
      .single();

    if (eErr) throw eErr;

    res.json({ 
      success: true, 
      message: 'Payment verified and enrollment created',
      enrollment 
    });
  } catch (err) {
    console.error('Payment verification error:', err);
    next(err);
  }
});

// GET /api/payments/check-enrollment/:courseId - Check if user has paid for course
router.get('/check-enrollment/:courseId', async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const token = req.headers?.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) return res.status(401).json({ error: 'Invalid token' });
    const user = userData.user;

    const { data: enrollment, error } = await supabase
      .from('enrollments')
      .select('*')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows

    res.json({ 
      enrolled: !!enrollment,
      purchased: enrollment?.purchased || false,
      enrollment: enrollment || null
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
