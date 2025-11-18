const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Initialize Stripe
let stripe = null;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    console.log('✅ Stripe initialized for course payments');
  } else {
    console.warn('⚠️  STRIPE_SECRET_KEY not found - course payments disabled');
  }
} catch (error) {
  console.error('❌ Failed to initialize Stripe:', error.message);
}

// GET /api/enrollments/mine - list current user's enrollments with course info
router.get('/mine', async (req, res, next) => {
  try {
    const token = req.headers?.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) return res.status(401).json({ error: 'Invalid token' });
    const user = userData.user;

    const { data, error } = await supabase
      .from('enrollments')
      .select('course_id, progress_percent, purchased, courses:course_id(id, title, description, category, level, price_cents, is_published)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Transform data to have course as top-level object
    const transformedData = data.map(enrollment => ({
      ...enrollment,
      course: enrollment.courses
    }));
    
    res.json({ data: transformedData });
  } catch (err) {
    next(err);
  }
});

// GET /api/enrollments/my-courses - alias for /mine
router.get('/my-courses', async (req, res, next) => {
  try {
    const token = req.headers?.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) return res.status(401).json({ error: 'Invalid token' });
    const user = userData.user;

    const { data, error } = await supabase
      .from('enrollments')
      .select('course_id, progress_percent, purchased, courses:course_id(id, title, description, category, level, price_cents, is_published)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Transform data to have course as top-level object
    const transformedData = data.map(enrollment => ({
      ...enrollment,
      course: enrollment.courses
    }));
    
    res.json({ data: transformedData });
  } catch (err) {
    next(err);
  }
});

// POST /api/enrollments/create-payment - Create Stripe payment session for course (MUST BE BEFORE /:courseId)
router.post('/create-payment', async (req, res) => {
  const { courseId, email, userId } = req.body;

  if (!courseId || !email) {
    return res.status(400).json({ error: 'Course ID and email are required' });
  }

  // Check if Stripe is initialized
  if (!stripe) {
    console.error('❌ Stripe not initialized');
    return res.status(500).json({ 
      error: 'Payment system not configured',
      details: 'Stripe is not available'
    });
  }

  try {
    console.log('📝 Creating payment session for course:', courseId);

    // Get course details
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, title, price_cents, instructor_id')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Check if course is free
    if (course.price_cents === 0) {
      return res.status(400).json({ error: 'This course is free, no payment required' });
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'zar',
            product_data: {
              name: course.title,
              description: 'Course enrollment on LearnTrack',
            },
            unit_amount: course.price_cents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/payment-success.html?session_id={CHECKOUT_SESSION_ID}&course_id=${courseId}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/courseDetail.html?id=${courseId}`,
      customer_email: email,
      metadata: {
        courseId: courseId,
        userId: userId,
        paymentType: 'course_enrollment'
      }
    });

    console.log('✅ Payment session created:', session.id);

    res.json({ 
      sessionId: session.id,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    });

  } catch (error) {
    console.error('❌ Stripe session creation error:', error);
    res.status(500).json({ error: 'Failed to create payment session', details: error.message });
  }
});

// POST /api/enrollments/verify-payment - Verify payment and enroll student (MUST BE BEFORE /:courseId)
router.post('/verify-payment', async (req, res) => {
  const { sessionId, courseId, userId } = req.body;

  if (!sessionId || !courseId) {
    return res.status(400).json({ error: 'Session ID and course ID are required' });
  }

  if (!stripe) {
    return res.status(500).json({ error: 'Payment system not configured' });
  }

  try {
    console.log('🔍 Verifying payment session:', sessionId);

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

    console.log('✅ Payment verified, enrolling student...');

    // Get course details
    const { data: course } = await supabase
      .from('courses')
      .select('price_cents')
      .eq('id', courseId)
      .single();

    // Verify amount matches
    if (course && session.amount_total !== course.price_cents) {
      return res.status(400).json({ error: 'Payment amount mismatch' });
    }

    // Check if already enrolled
    const { data: existing } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .single();

    if (existing) {
      return res.json({ 
        success: true,
        message: 'Already enrolled',
        enrollment: existing
      });
    }

    // Create enrollment with purchased flag
    const { data: enrollment, error: enrollError } = await supabase
      .from('enrollments')
      .insert({ 
        user_id: userId, 
        course_id: courseId,
        purchased: true,
        progress_percent: 0
      })
      .select()
      .single();

    if (enrollError) {
      console.error('❌ Enrollment error:', enrollError);
      throw enrollError;
    }

    console.log('✅ Student enrolled successfully');

    res.json({ 
      success: true,
      message: 'Payment verified and enrolled successfully',
      enrollment: enrollment
    });

  } catch (error) {
    console.error('❌ Payment verification error:', error);
    res.status(500).json({ error: 'Failed to verify payment', details: error.message });
  }
});

// POST /api/enrollments/enroll - enroll current user into a course (MUST BE BEFORE /:courseId)
router.post('/enroll', async (req, res, next) => {
  try {
    const token = req.headers?.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) return res.status(401).json({ error: 'Invalid token' });
    const user = userData.user;
    const { course_id, purchased } = req.body;

    if (!course_id) {
      return res.status(400).json({ error: 'course_id is required' });
    }

    // Check if already enrolled
    const { data: existing } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', course_id)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'You are already enrolled in this course' });
    }

    const { data, error } = await supabase
      .from('enrollments')
      .insert({ 
        user_id: user.id, 
        course_id: course_id,
        purchased: purchased || false
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /api/enrollments/:courseId - enroll current user into a course (generic route, MUST BE LAST)
router.post('/:courseId', async (req, res, next) => {
  try {
    const token = req.headers?.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) return res.status(401).json({ error: 'Invalid token' });
    const user = userData.user;
    const { courseId } = req.params;

    const { data, error } = await supabase
      .from('enrollments')
      .upsert({ user_id: user.id, course_id: courseId }, { onConflict: 'user_id,course_id' })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
