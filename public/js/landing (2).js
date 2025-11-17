/**
 * Landing Page - Load Featured Courses from API
 */

// Load actual courses from database
async function loadFeaturedCourses() {
  try {
    const response = await fetch('/api/courses');
    
    if (!response.ok) {
      console.error('Failed to load courses');
      return;
    }

    const { data: courses } = await response.json();
    
    // Filter only published courses
    const publishedCourses = courses.filter(c => c.is_published);
    
    // Sort by rating (highest first), then by enrollment count
    const sortedCourses = publishedCourses.sort((a, b) => {
      // Prioritize courses with ratings
      if (b.rating !== a.rating) {
        return (b.rating || 0) - (a.rating || 0);
      }
      // Then by rating count (more ratings = more popular)
      return (b.rating_count || 0) - (a.rating_count || 0);
    });
    
    // Take top 3 courses for featured section
    const featuredCourses = sortedCourses.slice(0, 3);
    
    const container = document.getElementById('courses-container');
    
    if (!container) {
      console.error('Courses container not found');
      return;
    }
    
    if (featuredCourses.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-12">
          <p class="text-gray-600">No courses available at the moment. Check back soon!</p>
        </div>
      `;
      return;
    }

    // Color gradients for course cards
    const gradients = [
      'from-indigo-400 to-purple-600',
      'from-blue-400 to-blue-600',
      'from-pink-400 to-rose-600',
      'from-green-400 to-emerald-600',
      'from-orange-400 to-red-600',
      'from-purple-400 to-pink-600'
    ];

    // Render courses
    const coursesHTML = featuredCourses.map((course, index) => {
      const gradient = gradients[index % gradients.length];
      const price = course.price_cents > 0 ? `R${(course.price_cents / 100).toFixed(2)}` : 'Free';
      const rating = course.rating > 0 ? course.rating.toFixed(1) : 'New';
      const ratingCount = course.rating_count > 0 ? `(${course.rating_count})` : '';
      const badge = index === 0 ? 'Top Rated' : index === 1 ? 'Most Popular' : 'Featured';
      const badgeColor = index === 0 ? 'bg-yellow-100 text-yellow-700' : index === 1 ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700';
      
      return `
        <article class="fade-up card-hover bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 visible">
          <div class="shine h-48 bg-gradient-to-br ${gradient} flex items-center justify-center">
            <span class="text-white text-2xl font-bold">${course.title.substring(0, 20)}</span>
          </div>
          <div class="p-6">
            <div class="flex items-center gap-2 mb-3">
              <span class="px-3 py-1 ${badgeColor} text-xs font-semibold rounded-full">${badge}</span>
              ${course.rating > 0 ? `
                <span class="text-yellow-500 text-sm flex items-center gap-1">
                  <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                  ${rating}
                </span>
                <span class="text-gray-500 text-sm">${ratingCount}</span>
              ` : '<span class="text-gray-500 text-sm flex items-center gap-1"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> New Course</span>'}
            </div>
            <h3 class="text-xl font-bold mb-2 line-clamp-1" title="${course.title}">${course.title}</h3>
            <p class="text-gray-600 text-sm mb-4 line-clamp-2">${course.description || 'No description available'}</p>
            <div class="flex items-center justify-between mb-4">
              <span class="text-gray-500 text-sm">${course.category} • ${course.level}</span>
              <span class="text-2xl font-bold text-indigo-600">${price}</span>
            </div>
            <a href="signUp.html" class="block w-full text-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors">
              Enroll Now
            </a>
          </div>
        </article>
      `;
    }).join('');

    container.innerHTML = coursesHTML;
    
  } catch (err) {
    console.error('Failed to load courses:', err);
    const container = document.getElementById('courses-container');
    if (container) {
      container.innerHTML = `
        <div class="col-span-full text-center py-12">
          <p class="text-gray-600">Unable to load courses. Please try again later.</p>
        </div>
      `;
    }
  }
}

// Load courses when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadFeaturedCourses);
} else {
  loadFeaturedCourses();
}
