const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Use admin client for backend operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Helper to extract and verify JWT token
 */
async function getAuthenticatedUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch (err) {
    console.error('Auth error:', err);
    return null;
  }
}

/**
 * GET /api/certificates/my-certificates
 * Get all certificates for authenticated user
 */
router.get('/my-certificates', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: certificates, error } = await supabase
      .from('certificates')
      .select(`
        *,
        courses (title, description)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Add student profile to each certificate
    if (certificates && certificates.length > 0) {
      for (const cert of certificates) {
        try {
          const { data: studentProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', cert.user_id)
            .maybeSingle();

          if (studentProfile) {
            cert.profiles = studentProfile;
          } else {
            cert.profiles = {
              full_name: cert.student_name || 'Student'
            };
          }
        } catch (err) {
          cert.profiles = {
            full_name: cert.student_name || 'Student'
          };
        }
      }
    }

    // Return in the format the frontend expects
    res.json({ data: certificates || [] });

  } catch (err) {
    console.error('Error fetching certificates:', err);
    res.status(500).json({ error: 'Failed to fetch certificates', details: err.message });
  }
});

router.get('/:certificateId', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { certificateId } = req.params;

    // Fetch certificate with related data
    const { data: certificate, error } = await supabase
      .from('certificates')
      .select(`
        *,
        courses (
          id,
          title,
          description,
          instructor_id
        )
      `)
      .eq('id', certificateId)
      .single();

    if (error) throw error;
    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    // Verify the certificate belongs to the user
    if (certificate.user_id !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Fetch student profile separately
    if (certificate.user_id) {
      try {
        const { data: studentProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', certificate.user_id)
          .maybeSingle();

        if (studentProfile) {
          certificate.profiles = studentProfile;
        } else {
          // Fallback: use student_name from certificate or default
          certificate.profiles = {
            full_name: certificate.student_name || 'Student'
          };
        }
      } catch (err) {
        console.warn('Could not fetch student profile:', err.message);
        certificate.profiles = {
          full_name: certificate.student_name || 'Student'
        };
      }
    }

    // Fetch instructor details separately with proper error handling
    if (certificate.courses?.instructor_id) {
      try {
        console.log('Fetching instructor with ID:', certificate.courses.instructor_id);
        const { data: instructor, error: instructorError } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', certificate.courses.instructor_id)
          .maybeSingle(); // Use maybeSingle() to return null if not found instead of error

        if (instructorError) {
          console.warn('Instructor profile query error:', instructorError.message);
          certificate.courses.instructor = {
            full_name: 'Instructor'
          };
        } else if (instructor) {
          certificate.courses.instructor = instructor;
        } else {
          // No profile found - use default
          console.log('No profile found for instructor, using default name');
          certificate.courses.instructor = {
            full_name: 'Instructor'
          };
        }
      } catch (err) {
        console.error('Error fetching instructor details:', err);
        // Set default values if there's an error
        certificate.courses.instructor = {
          full_name: 'Instructor'
        };
      }
    }

    res.json({ data: certificate });

  } catch (err) {
    console.error('Get certificate error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch certificate', 
      details: err.message 
    });
  }
});

module.exports = router;
