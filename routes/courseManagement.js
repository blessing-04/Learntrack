const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');

require('dotenv').config();

const router = express.Router();

// Configure multer for file uploads (memory storage)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Required env vars:
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase env vars. Make sure SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are set.');
}

// Service client (for admin actions if ever needed)
const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Anon client template (we will create per-token clients when needed)
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Helper: getAccessToken(req)
 * Reads Authorization header "Bearer <token>" or query param token
 */
function getAccessToken(req) {
  const auth = req.headers?.authorization || req.query?.token || req.body?.token;
  if (!auth) return null;
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7);
  return auth;
}

/**
 * Helper: clientForToken(token)
 * Returns a Supabase client that attaches the token as a Bearer header so
 * auth.getUser() and DB calls run under the user's session.
 */
function clientForToken(token) {
  // create a new client with the anon key but with global Authorization header
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
}

/**
 * Middleware: requireAuth
 * ensures token present and valid; attaches supabase client and user to req
 */
async function requireAuth(req, res, next) {
  try {
    const token = getAccessToken(req);
    if (!token) return res.status(401).json({ error: 'Missing Authorization token' });

    const sup = clientForToken(token);
    const { data, error } = await sup.auth.getUser();
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.supabase = sup;
    req.user = data.user;
    req.token = token;
    next();
  } catch (err) {
    console.error('Auth middleware error', err);
    res.status(500).json({ error: 'Authentication check failed' });
  }
}

/**
 * GET /verify
 * Returns the role of the currently authenticated user.
 */
router.get('/verify', requireAuth, async (req, res) => {
  try {
    const role = req.user.user_metadata?.role || 'learner';
    res.json({ role });
  } catch (err) {
    console.error('Verify error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /:courseId/upload-file
 * Upload a file to Supabase Storage
 */
router.post('/:courseId/upload-file', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { fileType } = req.body; // 'video', 'document', 'thumbnail'
    const file = req.file;

    console.log('Upload request - courseId:', courseId, 'fileType:', fileType, 'file:', file?.originalname);

    if (!file) {
      console.error('No file in request');
      return res.status(400).json({ error: 'No file provided' });
    }

    if (!fileType) {
      console.error('No fileType in request');
      return res.status(400).json({ error: 'fileType is required (video, document, or thumbnail)' });
    }

    // Verify course ownership
    console.log('Verifying course ownership for courseId:', courseId);
    const { data: course, error: courseError } = await supabaseService
      .from('courses')
      .select('id, instructor_id')
      .eq('id', courseId)
      .single();

    if (courseError) {
      console.error('Course lookup error:', courseError);
      return res.status(404).json({ error: 'Course not found', details: courseError.message });
    }

    if (!course) {
      console.error('Course not found in database');
      return res.status(404).json({ error: 'Course not found' });
    }

    console.log('Course found:', course.id, 'Instructor:', course.instructor_id, 'User:', req.user.id);

    if (course.instructor_id !== req.user.id) {
      console.error('User not authorized - course instructor:', course.instructor_id, 'user:', req.user.id);
      return res.status(403).json({ error: 'Not authorized to upload files to this course' });
    }

    console.log('Authorization successful');

    // Determine bucket based on file type
    const bucketMap = {
      'video': 'course-videos',
      'document': 'course-documents',
      'thumbnail': 'course-thumbnails'
    };

    const bucket = bucketMap[fileType];
    if (!bucket) {
      return res.status(400).json({ error: 'Invalid fileType. Must be video, document, or thumbnail' });
    }

    // Generate unique file path
    const timestamp = Date.now();
    const filePath = `${courseId}/${timestamp}-${file.originalname}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseService.storage
      .from(bucket)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return res.status(500).json({ error: 'Storage upload failed: ' + (uploadError.message || 'Unknown error') });
    }

    console.log('File uploaded to storage successfully:', filePath);

    // Get public URL
    const { data: publicUrlData } = supabaseService.storage
      .from(bucket)
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    // Save file reference to course_files table
    const { data: fileRecord, error: dbError } = await supabaseService
      .from('course_files')
      .insert({
        course_id: courseId,
        file_type: fileType,
        file_name: file.originalname,
        file_url: publicUrl,
        file_size: file.size,
        mime_type: file.mimetype
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      // File uploaded but DB save failed - continue anyway
    }

    res.json({
      success: true,
      file: {
        url: publicUrl,
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
        fileType: fileType
      }
    });
  } catch (err) {
    console.error('File upload error:', err);
    next(err);
  }
});

/**
 * POST /create
 * Create a course (instructor-only)
 */
router.post('/create', requireAuth, async (req, res, next) => {
  try {
    const supabase = req.supabase;
    const user = req.user;

    const role = user.user_metadata?.role;
    if (role !== 'instructor') {
      return res.status(403).json({ error: 'Only instructors can create courses' });
    }

    const {
      title,
      description,
      category,
      level,
      language,
      price_cents,
      is_published = false,
      thumbnail_url
    } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({ error: 'Title, description, and category are required' });
    }

    // Store content metadata if provided
    const contentData = req.body.content || {};

    const insertPayload = {
      title,
      description,
      category,
      level: level || 'Beginner',
      language: language || 'English',
      price_cents: price_cents || 0,
      is_published,
      instructor_id: user.id,
      rating: 0,
      rating_count: 0,
      content_data: contentData // Store content metadata
    };

    const { data: course, error } = await supabase
      .from('courses')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error', error);
      return res.status(500).json({ error: error.message || 'Failed to create course' });
    }

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: course
    });
  } catch (err) {
    console.error('Course creation error:', err);
    next(err);
  }
});

/**
 * PUT /:courseId
 * Update course (owner/instructor only)
 */
router.put('/:courseId', requireAuth, async (req, res, next) => {
  try {
    const supabase = req.supabase;
    const user = req.user;
    const { courseId } = req.params;

    // fetch course
    const { data: found, error: foundErr } = await supabase
      .from('courses')
      .select('id, instructor_id')
      .eq('id', courseId)
      .single();

    if (foundErr || !found) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (found.instructor_id !== user.id) {
      return res.status(403).json({ error: 'Not authorized to update this course' });
    }

    const updateData = {};
    const allowedFields = ['title', 'description', 'category', 'level', 'language', 'price_cents', 'is_published', 'thumbnail_url'];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    const { data: updated, error } = await supabase
      .from('courses')
      .update(updateData)
      .eq('id', courseId)
      .select()
      .single();

    if (error) {
      console.error('Update error', error);
      return res.status(500).json({ error: error.message || 'Failed to update course' });
    }

    res.json({
      success: true,
      message: 'Course updated successfully',
      data: updated
    });
  } catch (err) {
    console.error('Update error:', err);
    next(err);
  }
});

/**
 * DELETE /:courseId
 */
router.delete('/:courseId', requireAuth, async (req, res, next) => {
  try {
    const supabase = req.supabase;
    const user = req.user;
    const { courseId } = req.params;

    const { data: found, error: foundErr } = await supabase
      .from('courses')
      .select('id, instructor_id')
      .eq('id', courseId)
      .single();

    if (foundErr || !found) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (found.instructor_id !== user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this course' });
    }

    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', courseId);

    if (error) {
      console.error('Delete error', error);
      return res.status(500).json({ error: error.message || 'Failed to delete course' });
    }

    res.json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (err) {
    console.error('Delete error:', err);
    next(err);
  }
});

/**
 * GET /my-courses
 */
router.get('/my-courses', requireAuth, async (req, res, next) => {
  try {
    const supabase = req.supabase;
    const user = req.user;

    const { data: courses, error } = await supabase
      .from('courses')
      .select('*')
      .eq('instructor_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch my-courses error', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch courses' });
    }

    res.json({ data: courses });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /:courseId/sections
 */
router.post('/:courseId/sections', requireAuth, async (req, res, next) => {
  try {
    const supabase = req.supabase;
    const user = req.user;
    const { courseId } = req.params;
    const { title, position } = req.body;

    // Verify course ownership
    const { data: found, error: foundErr } = await supabase
      .from('courses')
      .select('id, instructor_id')
      .eq('id', courseId)
      .single();

    if (foundErr || !found) return res.status(404).json({ error: 'Course not found' });
    if (found.instructor_id !== user.id) return res.status(403).json({ error: 'Not authorized' });

    const { data: section, error } = await supabase
      .from('sections')
      .insert({
        course_id: courseId,
        title,
        position: position || 0
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: section
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /sections/:sectionId/lessons (legacy route)
 */
router.post('/sections/:sectionId/lessons', requireAuth, async (req, res, next) => {
  try {
    const supabase = req.supabase;
    const user = req.user;
    const { sectionId } = req.params;
    const { title, video_url, resource_urls, position } = req.body;

    // Get section and course to verify instructor
    const { data: section } = await supabase
      .from('sections')
      .select('id, course_id')
      .eq('id', sectionId)
      .single();

    if (!section) return res.status(404).json({ error: 'Section not found' });

    const { data: course } = await supabase
      .from('courses')
      .select('id, instructor_id')
      .eq('id', section.course_id)
      .single();

    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (course.instructor_id !== user.id) return res.status(403).json({ error: 'Not authorized' });

    const { data: lesson, error } = await supabase
      .from('lessons')
      .insert({
        section_id: sectionId,
        title,
        video_url: video_url || null,
        resource_urls: resource_urls || [],
        position: position || 0
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: lesson
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /:courseId/sections/:sectionId/lessons
 * Add lesson to a section
 */
router.post('/:courseId/sections/:sectionId/lessons', requireAuth, async (req, res, next) => {
  try {
    const supabase = req.supabase;
    const user = req.user;
    const { courseId, sectionId } = req.params;
    const { title, video_url, resource_urls, position } = req.body;

    // Verify course ownership
    const { data: course } = await supabase
      .from('courses')
      .select('id, instructor_id')
      .eq('id', courseId)
      .single();

    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (course.instructor_id !== user.id) return res.status(403).json({ error: 'Not authorized' });

    const { data: lesson, error } = await supabase
      .from('lessons')
      .insert({
        section_id: sectionId,
        title,
        video_url: video_url || null,
        resource_urls: resource_urls || [],
        position: position || 0
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: lesson
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /:courseId/sections/:sectionId
 * Delete a section and all its lessons
 */
router.delete('/:courseId/sections/:sectionId', requireAuth, async (req, res, next) => {
  try {
    const supabase = req.supabase;
    const user = req.user;
    const { courseId, sectionId } = req.params;

    // Verify course ownership
    const { data: course } = await supabase
      .from('courses')
      .select('id, instructor_id')
      .eq('id', courseId)
      .single();

    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (course.instructor_id !== user.id) return res.status(403).json({ error: 'Not authorized' });

    // Delete section (lessons will be deleted via CASCADE)
    const { error } = await supabase
      .from('sections')
      .delete()
      .eq('id', sectionId);

    if (error) throw error;

    res.json({ success: true, message: 'Section deleted' });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /:courseId/sections/:sectionId/lessons/:lessonId
 * Delete a lesson
 */
router.delete('/:courseId/sections/:sectionId/lessons/:lessonId', requireAuth, async (req, res, next) => {
  try {
    const supabase = req.supabase;
    const user = req.user;
    const { courseId, lessonId } = req.params;

    // Verify course ownership
    const { data: course } = await supabase
      .from('courses')
      .select('id, instructor_id')
      .eq('id', courseId)
      .single();

    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (course.instructor_id !== user.id) return res.status(403).json({ error: 'Not authorized' });

    // Delete lesson
    const { error } = await supabase
      .from('lessons')
      .delete()
      .eq('id', lessonId);

    if (error) throw error;

    res.json({ success: true, message: 'Lesson deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
