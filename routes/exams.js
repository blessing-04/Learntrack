const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Use admin client for all backend operations (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Keep alias for backwards compatibility
const supabaseAdmin = supabase;

/**
 * Helper: Get authenticated user from token
 */
async function getAuthenticatedUser(req) {
  const token = req.headers?.authorization?.replace('Bearer ', '');
  if (!token) return null;

  const { data: userData, error } = await supabase.auth.getUser(token);
  if (error || !userData.user) return null;

  return userData.user;
}

// ============================================
// INSTRUCTOR ENDPOINTS (Exam Management)
// ============================================

/**
 * POST /api/exams
 * Create a new exam
 */
router.post('/', async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { course_id, title, description, exam_type, passing_score, time_limit, allow_retakes } = req.body;

    if (!course_id || !title) {
      return res.status(400).json({ error: 'course_id and title are required' });
    }

    // Verify course ownership (use admin client to bypass RLS)
    const { data: course, error: courseErr } = await supabaseAdmin
      .from('courses')
      .select('instructor_id')
      .eq('id', course_id)
      .single();

    if (courseErr) throw courseErr;
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (course.instructor_id !== user.id) return res.status(403).json({ error: 'Not authorized' });

    // Create exam (use admin client for insert)
    const { data: exam, error: insertError } = await supabaseAdmin
      .from('exams')
      .insert({
        course_id,
        title,
        description,
        exam_type: exam_type || 'final',
        passing_score: passing_score || 75,
        time_limit: time_limit || null,
        allow_retakes: allow_retakes !== undefined ? allow_retakes : true,
        is_published: false,
        total_points: 0
      })
      .select()
      .single();

    if (insertError) throw insertError;

    res.status(201).json({ 
      success: true,
      data: exam,
      message: 'Exam created successfully'
    });
  } catch (err) {
    console.error('Create exam error:', err);
    next(err);
  }
});

/**
 * POST /api/exams/:examId/questions
 * Add a question to an exam
 */
router.post('/:examId/questions', async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { examId } = req.params;
    const { question, options, correct_answer, explanation, points, position } = req.body;

    if (!question || !correct_answer) {
      return res.status(400).json({ error: 'question and correct_answer are required' });
    }

    // Verify exam ownership
    const { data: exam, error: examErr } = await supabaseAdmin
      .from('exams')
      .select('*, courses!inner(instructor_id)')
      .eq('id', examId)
      .single();

    if (examErr) throw examErr;
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (exam.courses.instructor_id !== user.id) return res.status(403).json({ error: 'Not authorized' });

    // Get current max position
    const { data: maxPos } = await supabaseAdmin
      .from('exam_questions')
      .select('position')
      .eq('exam_id', examId)
      .order('position', { ascending: false })
      .limit(1);

    const nextPosition = maxPos && maxPos.length > 0 ? maxPos[0].position + 1 : 0;

    // Insert question
    const { data: examQuestion, error: insertError } = await supabaseAdmin
      .from('exam_questions')
      .insert({
        exam_id: examId,
        question,
        question_type: 'multiple_choice',
        options,
        correct_answer,
        explanation,
        points: points || 10,
        position: position !== undefined ? position : nextPosition
      })
      .select()
      .single();

    if (insertError) throw insertError;

    res.status(201).json({
      success: true,
      data: examQuestion,
      message: 'Question added successfully'
    });
  } catch (err) {
    console.error('Add question error:', err);
    next(err);
  }
});

/**
 * GET /api/exams/:examId/questions
 * Get all questions for an exam
 */
router.get('/:examId/questions', async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { examId } = req.params;

    // Get questions
    const { data: questions, error } = await supabaseAdmin
      .from('exam_questions')
      .select('*')
      .eq('exam_id', examId)
      .order('position', { ascending: true });

    if (error) throw error;

    res.json({ 
      success: true,
      data: questions || []
    });
  } catch (err) {
    console.error('Get questions error:', err);
    next(err);
  }
});

/**
 * PUT /api/exams/:examId/questions/:questionId
 * Update a question
 */
router.put('/:examId/questions/:questionId', async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { examId, questionId } = req.params;
    const updateData = req.body;

    // Verify ownership
    const { data: exam, error: examErr } = await supabase
      .from('exams')
      .select('*, courses!inner(instructor_id)')
      .eq('id', examId)
      .single();

    if (examErr) throw examErr;
    if (exam.courses.instructor_id !== user.id) return res.status(403).json({ error: 'Not authorized' });

    // Update question
    const { data: question, error: updateError } = await supabase
      .from('exam_questions')
      .update(updateData)
      .eq('id', questionId)
      .eq('exam_id', examId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({ 
      success: true,
      data: question,
      message: 'Question updated successfully'
    });
  } catch (err) {
    console.error('Update question error:', err);
    next(err);
  }
});

/**
 * DELETE /api/exams/:examId/questions/:questionId
 * Delete a question
 */
router.delete('/:examId/questions/:questionId', async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { examId, questionId } = req.params;

    // Verify ownership
    const { data: exam, error: examErr } = await supabase
      .from('exams')
      .select('*, courses!inner(instructor_id)')
      .eq('id', examId)
      .single();

    if (examErr) throw examErr;
    if (exam.courses.instructor_id !== user.id) return res.status(403).json({ error: 'Not authorized' });

    // Delete question
    const { error: deleteError } = await supabase
      .from('exam_questions')
      .delete()
      .eq('id', questionId)
      .eq('exam_id', examId);

    if (deleteError) throw deleteError;

    res.json({ 
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (err) {
    console.error('Delete question error:', err);
    next(err);
  }
});

/**
 * PUT /api/exams/:examId/publish
 * Publish/unpublish an exam
 */
router.put('/:examId/publish', async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { examId } = req.params;
    const { is_published } = req.body;

    // Verify ownership
    const { data: exam, error: examErr } = await supabase
      .from('exams')
      .select('*, courses!inner(instructor_id)')
      .eq('id', examId)
      .single();

    if (examErr) throw examErr;
    if (exam.courses.instructor_id !== user.id) return res.status(403).json({ error: 'Not authorized' });

    // Check if exam has questions
    const { data: questions } = await supabase
      .from('exam_questions')
      .select('id')
      .eq('exam_id', examId);

    if (!questions || questions.length === 0) {
      return res.status(400).json({ error: 'Cannot publish exam without questions' });
    }

    // Update publish status
    const { data: updatedExam, error: updateError } = await supabase
      .from('exams')
      .update({ is_published, updated_at: new Date().toISOString() })
      .eq('id', examId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({ 
      success: true,
      data: updatedExam,
      message: is_published ? 'Exam published successfully' : 'Exam unpublished'
    });
  } catch (err) {
    console.error('Publish exam error:', err);
    next(err);
  }
});

/**
 * GET /api/exams/course/:courseId
 * Get all exams for a course (instructor or student view)
 */
router.get('/course/:courseId', async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { courseId } = req.params;

    // Check if user is instructor
    const { data: course } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', courseId)
      .single();

    const isInstructor = course && course.instructor_id === user.id;

    // Get exams
    let query = supabase
      .from('exams')
      .select('*')
      .eq('course_id', courseId);

    // Students only see published exams
    if (!isInstructor) {
      query = query.eq('is_published', true);
    }

    const { data: exams, error } = await query.order('position', { ascending: true });

    if (error) throw error;

    // For each exam, get question count and user's attempts
    const examsWithDetails = await Promise.all(exams.map(async (exam) => {
      // Get question count
      const { data: questions } = await supabase
        .from('exam_questions')
        .select('id')
        .eq('exam_id', exam.id);

      const questionCount = questions ? questions.length : 0;

      // Get user's attempts
      const { data: attempts } = await supabase
        .from('exam_attempts')
        .select('percentage, submitted_at, status, attempt_number')
        .eq('exam_id', exam.id)
        .eq('user_id', user.id)
        .eq('status', 'submitted')
        .order('percentage', { ascending: false });

      const bestAttempt = attempts && attempts.length > 0 ? attempts[0] : null;

      return {
        ...exam,
        question_count: questionCount,
        user_attempts: attempts ? attempts.length : 0,
        user_best_score: bestAttempt ? bestAttempt.percentage : null,
        user_passed: bestAttempt ? (bestAttempt.percentage >= exam.passing_score) : false
      };
    }));

    res.json({ 
      success: true,
      data: examsWithDetails
    });
  } catch (err) {
    console.error('Get course exams error:', err);
    next(err);
  }
});

/**
 * DELETE /api/exams/:examId
 * Delete an exam
 */
router.delete('/:examId', async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { examId } = req.params;

    // Verify ownership
    const { data: exam, error: examErr } = await supabase
      .from('exams')
      .select('*, courses!inner(instructor_id)')
      .eq('id', examId)
      .single();

    if (examErr) throw examErr;
    if (exam.courses.instructor_id !== user.id) return res.status(403).json({ error: 'Not authorized' });

    // Delete exam (cascade will delete questions and attempts)
    const { error: deleteError } = await supabase
      .from('exams')
      .delete()
      .eq('id', examId);

    if (deleteError) throw deleteError;

    res.json({ 
      success: true,
      message: 'Exam deleted successfully'
    });
  } catch (err) {
    console.error('Delete exam error:', err);
    next(err);
  }
});

// ============================================
// STUDENT ENDPOINTS (Taking Exams)
// ============================================

/**
 * GET /api/exams/:examId
 * Get exam details for taking
 */
router.get('/:examId', async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { examId } = req.params;

    // Get exam
    const { data: exam, error: examErr } = await supabase
      .from('exams')
      .select('*')
      .eq('id', examId)
      .single();

    if (examErr) throw examErr;
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    // Check enrollment
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', exam.course_id)
      .single();

    if (!enrollment) {
      return res.status(403).json({ error: 'You must be enrolled in this course' });
    }

    // Get questions
    const { data: questions } = await supabase
      .from('exam_questions')
      .select('id, question, options, points, position')
      .eq('exam_id', examId)
      .order('position', { ascending: true });

    // Get previous attempts
    const { data: attempts } = await supabase
      .from('exam_attempts')
      .select('attempt_number, percentage, submitted_at, status')
      .eq('exam_id', examId)
      .eq('user_id', user.id)
      .order('attempt_number', { ascending: false });

    const totalAttempts = attempts ? attempts.filter(a => a.status === 'submitted').length : 0;

    // Check if retakes allowed
    if (!exam.allow_retakes && totalAttempts > 0) {
      return res.status(403).json({ 
        error: 'Retakes not allowed',
        attempts
      });
    }

    res.json({
      success: true,
      data: {
        exam,
        questions: questions || [],
        previous_attempts: attempts || [],
        total_attempts: totalAttempts
      }
    });
  } catch (err) {
    console.error('Get exam error:', err);
    next(err);
  }
});

/**
 * POST /api/exams/:examId/start
 * Start a new exam attempt
 */
router.post('/:examId/start', async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { examId } = req.params;

    // Get exam
    const { data: exam, error: examErr } = await supabase
      .from('exams')
      .select('*')
      .eq('id', examId)
      .single();

    if (examErr) throw examErr;

    // Get previous attempts
    const { data: previousAttempts } = await supabase
      .from('exam_attempts')
      .select('attempt_number')
      .eq('exam_id', examId)
      .eq('user_id', user.id)
      .order('attempt_number', { ascending: false });

    const nextAttemptNumber = previousAttempts && previousAttempts.length > 0
      ? previousAttempts[0].attempt_number + 1
      : 1;

    // Check retakes
    if (!exam.allow_retakes && previousAttempts && previousAttempts.length > 0) {
      return res.status(403).json({ error: 'Retakes not allowed' });
    }

    // Create attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id: examId,
        user_id: user.id,
        course_id: exam.course_id,
        attempt_number: nextAttemptNumber,
        max_score: exam.total_points,
        status: 'in_progress'
      })
      .select()
      .single();

    if (attemptError) throw attemptError;

    res.status(201).json({ 
      success: true,
      data: attempt
    });
  } catch (err) {
    console.error('Start exam error:', err);
    next(err);
  }
});

/**
 * POST /api/exams/:examId/submit
 * Submit exam answers
 */
router.post('/:examId/submit', async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { examId } = req.params;
    const { attemptId, answers, timeSpent } = req.body;

    if (!attemptId || !answers) {
      return res.status(400).json({ error: 'attemptId and answers required' });
    }

    // Verify attempt
    const { data: attempt, error: attemptErr } = await supabase
      .from('exam_attempts')
      .select('*')
      .eq('id', attemptId)
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .single();

    if (attemptErr || !attempt) {
      return res.status(404).json({ error: 'Attempt not found or already submitted' });
    }

    // Get questions with correct answers
    const { data: questions, error: questionsErr } = await supabase
      .from('exam_questions')
      .select('*')
      .eq('exam_id', examId)
      .order('position', { ascending: true});

    if (questionsErr) throw questionsErr;

    // Grade answers
    let totalScore = 0;
    let maxScore = 0;
    const gradedAnswers = [];

    for (const question of questions) {
      const userAnswer = answers[question.id];
      const isCorrect = userAnswer === question.correct_answer;
      const pointsEarned = isCorrect ? question.points : 0;

      totalScore += pointsEarned;
      maxScore += question.points;

      gradedAnswers.push({
        question_id: question.id,
        question: question.question,
        selected_answer: userAnswer,
        correct_answer: question.correct_answer,
        is_correct: isCorrect,
        points_earned: pointsEarned,
        max_points: question.points
      });
    }

    const percentage = maxScore > 0 ? ((totalScore / maxScore) * 100).toFixed(2) : 0;

    // Update attempt
    const { data: updatedAttempt, error: updateError } = await supabase
      .from('exam_attempts')
      .update({
        answers: gradedAnswers,
        score: totalScore,
        max_score: maxScore,
        percentage: percentage,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        graded_at: new Date().toISOString(),
        time_spent: timeSpent || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', attemptId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({ 
      success: true,
      data: updatedAttempt,
      message: 'Exam submitted and graded successfully'
    });
  } catch (err) {
    console.error('Submit exam error:', err);
    next(err);
  }
});

/**
 * POST /api/exams/:examId/attempts
 * Submit exam attempt (simplified - creates and submits in one go)
 */
router.post('/:examId/attempts', async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { examId } = req.params;
    const { answers, score, percentage } = req.body;

    // Get exam
    const { data: exam } = await supabaseAdmin
      .from('exams')
      .select('*')
      .eq('id', examId)
      .single();

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // Get previous attempts count
    const { data: previousAttempts } = await supabaseAdmin
      .from('exam_attempts')
      .select('attempt_number')
      .eq('exam_id', examId)
      .eq('user_id', user.id)
      .order('attempt_number', { ascending: false });

    const attemptNumber = previousAttempts && previousAttempts.length > 0
      ? previousAttempts[0].attempt_number + 1
      : 1;

    // Convert answers object to array format for database
    // Frontend sends: { "question-id": "B", ... }
    // Database expects: [{ question_id, selected_answer, ... }]
    const answersArray = Object.entries(answers || {}).map(([questionId, answer]) => ({
      question_id: questionId,
      selected_answer: answer
    }));

    // Create attempt
    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from('exam_attempts')
      .insert({
        exam_id: examId,
        user_id: user.id,
        course_id: exam.course_id,
        attempt_number: attemptNumber,
        score: score || 0,
        max_score: exam.total_points,
        percentage: percentage || 0,
        answers: answersArray,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        graded_at: new Date().toISOString()
      })
      .select()
      .single();

    if (attemptError) {
      console.error('Attempt insert error:', attemptError);
      throw attemptError;
    }

    // If passed final exam, mark course as 100% complete
    if (exam.exam_type === 'final' && percentage >= (exam.passing_score || 75)) {
      console.log(`Student passed final exam! Updating enrollment progress to 100%`);
      await supabaseAdmin
        .from('enrollments')
        .update({ 
          progress_percent: 100,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('course_id', exam.course_id);
    }

    res.status(201).json({
      success: true,
      data: attempt,
      message: 'Exam submitted successfully'
    });
  } catch (err) {
    console.error('Submit exam attempt error:', err);
    console.error('Error details:', {
      message: err.message,
      code: err.code,
      details: err.details,
      hint: err.hint
    });
    res.status(500).json({ 
      error: 'Failed to submit exam',
      details: err.message,
      hint: err.hint || 'Check server logs for more details'
    });
  }
});

/**
 * GET /api/exams/attempt/:attemptId
 * Get attempt results
 */
router.get('/attempt/:attemptId', async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { attemptId } = req.params;

    const { data: attempt, error } = await supabase
      .from('exam_attempts')
      .select(`
        *,
        exams!inner(*)
      `)
      .eq('id', attemptId)
      .eq('user_id', user.id)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: attempt
    });
  } catch (err) {
    console.error('Get attempt error:', err);
    next(err);
  }
});

/**
 * GET /api/exams/:examId/analytics
 * Get analytics data for an exam (instructor only)
 */
router.get('/:examId/analytics', async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { examId } = req.params;

    // Get exam and verify ownership
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('*, courses!inner(instructor_id)')
      .eq('id', examId)
      .single();

    if (examError) throw examError;
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (exam.courses.instructor_id !== user.id) {
      return res.status(403).json({ error: 'Not authorized to view analytics' });
    }

    // Get all attempts for this exam
    const { data: attempts, error: attemptsError } = await supabase
      .from('exam_attempts')
      .select('*')
      .eq('exam_id', examId)
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: false });

    if (attemptsError) throw attemptsError;

    // Calculate analytics
    const totalAttempts = attempts?.length || 0;
    const uniqueStudents = new Set(attempts?.map(a => a.user_id) || []).size;

    const scores = attempts?.map(a => a.percentage || 0) || [];
    const averageScore = scores.length > 0
      ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2)
      : 0;

    const passedCount = attempts?.filter(a => a.percentage >= (exam.passing_score || 0)).length || 0;
    const failedCount = totalAttempts - passedCount;
    const passRate = totalAttempts > 0 ? ((passedCount / totalAttempts) * 100).toFixed(2) : 0;

    // Calculate difficulty (inverse of average score)
    const difficulty = averageScore > 0 ? (100 - parseFloat(averageScore)).toFixed(2) : 100;

    // Get top performers
    const topPerformers = attempts
      ?.sort((a, b) => b.percentage - a.percentage)
      .slice(0, 5)
      .map(a => ({
        user_id: a.user_id,
        percentage: a.percentage,
        submitted_at: a.submitted_at
      })) || [];

    // Get score distribution
    const scoreRanges = {
      '0-25': 0,
      '26-50': 0,
      '51-75': 0,
      '76-100': 0
    };

    scores.forEach(score => {
      if (score <= 25) scoreRanges['0-25']++;
      else if (score <= 50) scoreRanges['26-50']++;
      else if (score <= 75) scoreRanges['51-75']++;
      else scoreRanges['76-100']++;
    });

    res.json({
      success: true,
      data: {
        quiz_info: {
          id: exam.id,
          question: exam.title,
          quiz_type: 'exam',
          points: exam.total_points,
          passing_score: exam.passing_score
        },
        summary: {
          total_attempts: totalAttempts,
          unique_students: uniqueStudents,
          average_score: parseFloat(averageScore),
          pass_rate: parseFloat(passRate),
          passed_count: passedCount,
          failed_count: failedCount,
          difficulty_score: parseFloat(difficulty)
        },
        score_distribution: scoreRanges,
        top_performers: topPerformers,
        recent_attempts: attempts?.slice(0, 10) || []
      }
    });
  } catch (err) {
    console.error('Get exam analytics error:', err);
    next(err);
  }
});

module.exports = router;
