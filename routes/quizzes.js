const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Use service role key for backend operations (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

/**
 * GET /api/quizzes/course/:courseId
 * Get all quizzes for a course
 */
router.get('/course/:courseId', async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { courseId } = req.params;

    // Get all quizzes for the course
    const { data: quizzes, error } = await supabase
      .from('course_quizzes')
      .select('*')
      .eq('course_id', courseId)
      .order('position', { ascending: true });

    if (error) throw error;

    // Get user's attempts for these quizzes
    const quizIds = quizzes.map(q => q.id);
    const { data: attempts } = await supabase
      .from('quiz_attempts')
      .select('quiz_id, score, max_score, percentage, attempt_number, submitted_at, status')
      .eq('user_id', user.id)
      .in('quiz_id', quizIds)
      .eq('status', 'submitted')
      .order('percentage', { ascending: false });

    // Combine quiz data with user's best attempt
    const quizzesWithAttempts = quizzes.map(quiz => {
      const userAttempts = attempts?.filter(a => a.quiz_id === quiz.id) || [];
      const bestAttempt = userAttempts[0]; // Already sorted by percentage desc
      const totalAttempts = userAttempts.length;

      return {
        ...quiz,
        user_best_score: bestAttempt?.percentage || null,
        user_attempts: totalAttempts,
        user_last_attempt: bestAttempt?.submitted_at || null,
        user_passed: bestAttempt ? (bestAttempt.percentage >= (quiz.passing_score || 0)) : false
      };
    });

    res.json({ data: quizzesWithAttempts });
  } catch (err) {
    console.error('Get course quizzes error:', err);
    next(err);
  }
});

/**
 * GET /api/quizzes/:quizId
 * Get quiz details (for taking quiz)
 */
router.get('/:quizId', async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { quizId } = req.params;

    // Get quiz details
    const { data: quiz, error } = await supabase
      .from('course_quizzes')
      .select('*')
      .eq('id', quizId)
      .single();

    if (error) throw error;
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Check if user is enrolled in the course
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', quiz.course_id)
      .single();

    if (!enrollment) {
      return res.status(403).json({ error: 'You must be enrolled in this course to take quizzes' });
    }

    // Get user's previous attempts
    const { data: attempts } = await supabase
      .from('quiz_attempts')
      .select('attempt_number, score, percentage, submitted_at, status')
      .eq('quiz_id', quizId)
      .eq('user_id', user.id)
      .order('attempt_number', { ascending: false });

    const totalAttempts = attempts?.filter(a => a.status === 'submitted').length || 0;

    // Check if retakes are allowed
    if (!quiz.allow_retakes && totalAttempts > 0) {
      return res.status(403).json({ 
        error: 'Retakes are not allowed for this quiz',
        attempts: attempts
      });
    }

    res.json({ 
      data: {
        quiz,
        previous_attempts: attempts || [],
        total_attempts: totalAttempts
      }
    });
  } catch (err) {
    console.error('Get quiz error:', err);
    next(err);
  }
});

/**
 * POST /api/quizzes/:quizId/start
 * Start a new quiz attempt
 */
router.post('/:quizId/start', async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { quizId } = req.params;

    // Get quiz details
    const { data: quiz, error: quizError } = await supabase
      .from('course_quizzes')
      .select('*, courses!inner(id)')
      .eq('id', quizId)
      .single();

    if (quizError) throw quizError;
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Get previous attempts count
    const { data: previousAttempts } = await supabase
      .from('quiz_attempts')
      .select('attempt_number')
      .eq('quiz_id', quizId)
      .eq('user_id', user.id)
      .order('attempt_number', { ascending: false });

    const nextAttemptNumber = previousAttempts?.length > 0 
      ? previousAttempts[0].attempt_number + 1 
      : 1;

    // Check if retakes allowed
    if (!quiz.allow_retakes && previousAttempts?.length > 0) {
      return res.status(403).json({ error: 'Retakes are not allowed for this quiz' });
    }

    // Create new attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('quiz_attempts')
      .insert({
        quiz_id: quizId,
        user_id: user.id,
        course_id: quiz.course_id,
        attempt_number: nextAttemptNumber,
        max_score: quiz.points || 10,
        status: 'in_progress'
      })
      .select()
      .single();

    if (attemptError) throw attemptError;

    res.status(201).json({ 
      data: attempt,
      message: 'Quiz attempt started'
    });
  } catch (err) {
    console.error('Start quiz attempt error:', err);
    next(err);
  }
});

/**
 * Helper: Grade answer based on question type
 */
function gradeAnswer(quiz, userAnswer) {
  const { quiz_type, correct_answer, points } = quiz;
  const maxPoints = points || 10;

  switch (quiz_type) {
    case 'multiple_choice':
    case 'true_false':
      // Simple comparison
      const isCorrect = userAnswer === correct_answer;
      return {
        is_correct: isCorrect,
        points_earned: isCorrect ? maxPoints : 0,
        max_points: maxPoints,
        can_auto_grade: true
      };

    case 'multiple_select':
      // User answer should be an array, correct_answer should be an array
      const userAnswers = Array.isArray(userAnswer) ? userAnswer.sort() : [];
      const correctAnswers = Array.isArray(correct_answer) ? correct_answer.sort() : [];
      const isMultiCorrect = JSON.stringify(userAnswers) === JSON.stringify(correctAnswers);
      return {
        is_correct: isMultiCorrect,
        points_earned: isMultiCorrect ? maxPoints : 0,
        max_points: maxPoints,
        can_auto_grade: true
      };

    case 'fill_blank':
      // Case-insensitive comparison, trim whitespace
      const userFill = (userAnswer || '').toString().trim().toLowerCase();
      const correctFill = (correct_answer || '').toString().trim().toLowerCase();
      const isFillCorrect = userFill === correctFill;
      return {
        is_correct: isFillCorrect,
        points_earned: isFillCorrect ? maxPoints : 0,
        max_points: maxPoints,
        can_auto_grade: true
      };

    case 'short_answer':
      // Cannot auto-grade, needs manual review
      return {
        is_correct: null,
        points_earned: 0,
        max_points: maxPoints,
        can_auto_grade: false,
        needs_grading: true
      };

    default:
      return {
        is_correct: false,
        points_earned: 0,
        max_points: maxPoints,
        can_auto_grade: false
      };
  }
}

/**
 * POST /api/quizzes/:quizId/submit
 * Submit quiz answers and get auto-graded results
 */
router.post('/:quizId/submit', async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { quizId } = req.params;
    const { attemptId, answers, timeSpent } = req.body;

    if (!attemptId || !answers) {
      return res.status(400).json({ error: 'attemptId and answers are required' });
    }

    // Get quiz details
    const { data: quiz, error: quizError } = await supabase
      .from('course_quizzes')
      .select('*')
      .eq('id', quizId)
      .single();

    if (quizError) throw quizError;

    // Verify attempt belongs to user and is in progress
    const { data: attempt, error: attemptError } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('id', attemptId)
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .single();

    if (attemptError || !attempt) {
      return res.status(404).json({ error: 'Quiz attempt not found or already submitted' });
    }

    // Grade the answer
    const userAnswer = answers.answer || answers.selected_answer;
    const grading = gradeAnswer(quiz, userAnswer);

    const totalScore = grading.points_earned;
    const maxScore = grading.max_points;
    const percentage = maxScore > 0 ? ((totalScore / maxScore) * 100).toFixed(2) : 0;

    const gradedAnswers = [{
      question_id: quiz.id,
      question: quiz.question,
      selected_answer: userAnswer,
      correct_answer: grading.can_auto_grade ? quiz.correct_answer : null,
      is_correct: grading.is_correct,
      points_earned: grading.points_earned,
      max_points: grading.max_points,
      needs_grading: grading.needs_grading || false
    }];

    // Update attempt with results
    const { data: updatedAttempt, error: updateError } = await supabase
      .from('quiz_attempts')
      .update({
        answers: gradedAnswers,
        score: totalScore,
        max_score: maxScore,
        percentage: percentage,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        graded_at: grading.can_auto_grade ? new Date().toISOString() : null,
        time_spent: timeSpent || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', attemptId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({
      data: updatedAttempt,
      message: grading.can_auto_grade
        ? 'Quiz submitted and graded successfully'
        : 'Quiz submitted. Awaiting instructor grading.'
    });
  } catch (err) {
    console.error('Submit quiz error:', err);
    next(err);
  }
});

/**
 * GET /api/quizzes/attempt/:attemptId
 * Get detailed results for a specific attempt
 */
router.get('/attempt/:attemptId', async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { attemptId } = req.params;

    // Get attempt details
    const { data: attempt, error } = await supabase
      .from('quiz_attempts')
      .select(`
        *,
        course_quizzes!inner(*)
      `)
      .eq('id', attemptId)
      .eq('user_id', user.id)
      .single();

    if (error) throw error;
    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    res.json({ data: attempt });
  } catch (err) {
    console.error('Get attempt error:', err);
    next(err);
  }
});

/**
 * GET /api/quizzes/:quizId/attempts
 * Get all attempts for a quiz by current user
 */
router.get('/:quizId/attempts', async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { quizId } = req.params;

    const { data: attempts, error} = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('quiz_id', quizId)
      .eq('user_id', user.id)
      .order('attempt_number', { ascending: false });

    if (error) throw error;

    res.json({ data: attempts || [] });
  } catch (err) {
    console.error('Get quiz attempts error:', err);
    next(err);
  }
});

/**
 * GET /api/quizzes/:quizId/analytics
 * Get analytics data for a quiz (instructor only)
 */
router.get('/:quizId/analytics', async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { quizId } = req.params;

    // Get quiz and verify ownership
    const { data: quiz, error: quizError } = await supabase
      .from('course_quizzes')
      .select('*, courses!inner(instructor_id)')
      .eq('id', quizId)
      .single();

    if (quizError) throw quizError;
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    if (quiz.courses.instructor_id !== user.id) {
      return res.status(403).json({ error: 'Not authorized to view analytics' });
    }

    // Get all attempts for this quiz
    const { data: attempts, error: attemptsError } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('quiz_id', quizId)
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

    const passedCount = attempts?.filter(a => a.percentage >= (quiz.passing_score || 0)).length || 0;
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
          id: quiz.id,
          question: quiz.question,
          quiz_type: quiz.quiz_type,
          points: quiz.points,
          passing_score: quiz.passing_score
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
    console.error('Get quiz analytics error:', err);
    next(err);
  }
});

module.exports = router;
