const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// GET /api/profiles/me - Get current user's profile with stats
router.get('/me', async (req, res, next) => {
  try {
    const token = req.headers?.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) return res.status(401).json({ error: 'Invalid token' });
    const user = userData.user;

    // Get user's enrollments with course info
    const { data: enrollments, error: enrollError } = await supabase
      .from('enrollments')
      .select('course_id, progress_percent, created_at, courses:course_id(id, title)')
      .eq('user_id', user.id);

    if (enrollError) throw enrollError;

    // Calculate statistics
    const enrolledCount = enrollments ? enrollments.length : 0;
    const completedCount = enrollments ? enrollments.filter(e => e.progress_percent === 100).length : 0;
    
    // Calculate learning hours (2 hours per enrolled course as baseline, +1 hour per 25% progress)
    let totalLearningHours = 0;
    if (enrollments) {
      enrollments.forEach(enrollment => {
        // Base 2 hours per course + additional hours based on progress
        const baseHours = 2;
        const progressHours = (enrollment.progress_percent / 25) * 0.5; // 0.5 hrs per 25% progress
        totalLearningHours += baseHours + progressHours;
      });
    }

    // Get last accessed course
    const lastCourse = enrollments && enrollments.length > 0 
      ? enrollments[0].courses?.title || 'No courses yet'
      : 'No courses yet';

    // Build profile data with all possible fields
    const profileData = {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Student',
      name: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Student',
      username: user.user_metadata?.username || user.email?.split('@')[0] || 'student',
      bio: user.user_metadata?.bio || '',
      avatar_url: user.user_metadata?.avatar_url || null,
      created_at: user.created_at,
      
      // Student fields
      learning_goals: user.user_metadata?.learning_goals || null,
      interests: user.user_metadata?.interests || null,
      
      // Instructor fields
      title: user.user_metadata?.title || null,
      expertise: user.user_metadata?.expertise || null,
      years_experience: user.user_metadata?.years_experience || null,
      linkedin: user.user_metadata?.linkedin || null,
      website: user.user_metadata?.website || null,
      twitter: user.user_metadata?.twitter || null,
      github: user.user_metadata?.github || null,
      
      // Statistics
      stats: {
        enrolled_courses: enrolledCount,
        completed_courses: completedCount,
        learning_hours: Math.round(totalLearningHours * 10) / 10, // Round to 1 decimal
        last_accessed_course: lastCourse
      }
    };

    res.json({ data: profileData });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/profiles/me - Update current user's profile
router.patch('/me', async (req, res, next) => {
  try {
    console.log('📝 PATCH /api/profiles/me - Profile update request received');
    
    const token = req.headers?.authorization?.replace('Bearer ', '');
    if (!token) {
      console.error('❌ No authorization token provided');
      return res.status(401).json({ error: 'Unauthorized', details: 'No token provided' });
    }

    console.log('✅ Token received (length:', token.length, ')');

    // Verify token is valid
    console.log('🔍 Verifying token with Supabase...');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError) {
      console.error('❌ Token verification failed:', userError.message);
      return res.status(401).json({ error: 'Invalid token', details: userError.message });
    }
    
    if (!userData || !userData.user) {
      console.error('❌ No user data returned from token');
      return res.status(401).json({ error: 'Invalid token', details: 'No user data' });
    }
    
    console.log('✅ Token valid for user:', userData.user.email);

    // Extract all possible profile fields from request body
    const { 
      full_name, 
      name, 
      username, 
      bio, 
      learning_goals, 
      interests,
      title,
      expertise,
      years_experience,
      linkedin,
      website,
      twitter,
      github
    } = req.body;

    // Build update object with all provided fields
    const updateData = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (name !== undefined) updateData.name = name || full_name;
    if (username !== undefined) updateData.username = username;
    if (bio !== undefined) updateData.bio = bio;
    if (learning_goals !== undefined) updateData.learning_goals = learning_goals;
    if (interests !== undefined) updateData.interests = interests;
    if (title !== undefined) updateData.title = title;
    if (expertise !== undefined) updateData.expertise = expertise;
    if (years_experience !== undefined) updateData.years_experience = years_experience;
    if (linkedin !== undefined) updateData.linkedin = linkedin;
    if (website !== undefined) updateData.website = website;
    if (twitter !== undefined) updateData.twitter = twitter;
    if (github !== undefined) updateData.github = github;

    // Update user metadata using admin client (service role key required)
    console.log('📝 Updating user metadata with:', Object.keys(updateData));
    
    // Use admin client to update user metadata
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
    
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userData.user.id,
      {
        user_metadata: updateData
      }
    );

    if (updateError) {
      console.error('❌ Failed to update user:', updateError.message);
      throw updateError;
    }
    
    console.log('✅ User profile updated successfully for:', userData.user.email);

    // Return updated profile
    const profileData = {
      id: updatedUser.user.id,
      email: updatedUser.user.email,
      full_name: updatedUser.user.user_metadata?.full_name || full_name,
      name: updatedUser.user.user_metadata?.name || name,
      username: updatedUser.user.user_metadata?.username || username,
      bio: updatedUser.user.user_metadata?.bio || bio,
      learning_goals: updatedUser.user.user_metadata?.learning_goals || learning_goals,
      interests: updatedUser.user.user_metadata?.interests || interests,
      title: updatedUser.user.user_metadata?.title || title,
      expertise: updatedUser.user.user_metadata?.expertise || expertise,
      years_experience: updatedUser.user.user_metadata?.years_experience || years_experience,
      linkedin: updatedUser.user.user_metadata?.linkedin || linkedin,
      website: updatedUser.user.user_metadata?.website || website,
      twitter: updatedUser.user.user_metadata?.twitter || twitter,
      github: updatedUser.user.user_metadata?.github || github,
      created_at: updatedUser.user.created_at
    };

    res.json({ data: profileData });
  } catch (err) {
    console.error('❌ Profile update error:', err.message);
    console.error('Error stack:', err.stack);
    res.status(500).json({ 
      error: 'Failed to update profile', 
      details: err.message 
    });
  }
});

module.exports = router;
