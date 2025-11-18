const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

router.get('/', async (req, res, next) => {
  try {

    let query = supabase.from('courses').select('*', { count: 'exact' });
    const { q, category, level, published, limit = 12, offset = 0 } = req.query;

    if (published === 'true') query = query.eq('is_published', true);
    if (published === 'false') query = query.eq('is_published', false);
    if (category) query = query.eq('category', category);
    if (level) query = query.eq('level', level);
    if (q) query = query.ilike('title', `%${q}%`);

    query = query.order('created_at', { ascending: false }).range(Number(offset), Number(offset) + Number(limit) - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, count });
  } catch (err) {
    next(err);
  }
});

// Get instructor's courses
router.get('/instructor', async (req, res, next) => {
  try {
    // Get instructor ID from auth token
    const token = req.headers?.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) {
      console.error('Auth error:', userError);
      return res.status(401).json({ error: 'Invalid token' });
    }
    const user = userData.user;

    if (!user || !user.id) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Get courses for this instructor
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('instructor_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    
    // Return empty array if no courses found
    res.json({ data: data || [] });
  } catch (err) {
    console.error('Instructor courses error:', err);
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase.from('courses').select('*').eq('id', id).single();
    if (error) throw error;
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/outline', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: sections, error } = await supabase
      .from('sections')
      .select('id, title, position, lessons:lessons(id, title, position, video_url, resource_urls)')
      .eq('course_id', id)
      .order('position', { ascending: true });

    if (error) throw error;
    res.json({ data: sections });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
