import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Landing = () => {
  const [text, setText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [loopNum, setLoopNum] = useState(0);
  const [typingSpeed, setTypingSpeed] = useState(150);

  const texts = [
    'Build Lasting Habits',
    'Track Your Progress',
    'Stay Committed',
    'Achieve Your Goals'
  ];

  useEffect(() => {
    const handleTyping = () => {
      const current = loopNum % texts.length;
      const fullText = texts[current];

      setText(
        isDeleting
          ? fullText.substring(0, text.length - 1)
          : fullText.substring(0, text.length + 1)
      );

      setTypingSpeed(isDeleting ? 30 : 150);

      if (!isDeleting && text === fullText) {
        setTimeout(() => setIsDeleting(true), 500);
      } else if (isDeleting && text === '') {
        setIsDeleting(false);
        setLoopNum(loopNum + 1);
      }
    };

    const timer = setTimeout(handleTyping, typingSpeed);
    return () => clearTimeout(timer);
  }, [text, isDeleting, loopNum, typingSpeed, texts]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-secondary-900 dark:to-secondary-800 transition-colors duration-200">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white dark:bg-secondary-800 bg-opacity-90 dark:bg-opacity-90 backdrop-blur-sm shadow-sm transition-colors duration-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <a href="#" className="font-display text-xl font-bold text-primary-600 dark:text-primary-400 hover:scale-105 transition-transform duration-200">
                Rituo
              </a>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/login" className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-medium transition-colors duration-200">
                Log In
              </Link>
              <Link to="/register" className="btn btn-primary transform hover:scale-105 active:scale-95 transition-all duration-200">
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-24 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-secondary-900 dark:text-white mb-6 animate-fade-in">
            Transform Your Daily Routine
          </h1>
          <p className="text-xl text-secondary-700 dark:text-secondary-300 max-w-3xl mx-auto mb-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <span className="text-primary-600 dark:text-primary-400 typewriter">{text}</span>
          </p>
          <p className="text-xl text-secondary-700 dark:text-secondary-300 max-w-3xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            Rituo helps you create and maintain daily habits through a 30-day locked-in commitment system. Track your progress, visualize your success, and build discipline.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <Link to="/register" className="btn btn-primary text-lg px-8 py-3 transform hover:scale-105 active:scale-95 transition-all duration-200">
              Start Your 30-Day Journey
            </Link>
            <a href="#features" className="btn btn-outline text-lg px-8 py-3 transform hover:scale-105 active:scale-95 transition-all duration-200">
              Learn More
            </a>
          </div>
          <div className="mt-8 animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <a 
              href="https://miricledev.github.io/md-landing-page/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 text-sm font-medium transition-all duration-300 hover:shadow-[0_0_15px_rgba(14,165,233,0.5)] dark:hover:shadow-[0_0_15px_rgba(56,189,248,0.5)] hover:scale-105"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Developed by miricledev
            </a>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white dark:bg-secondary-800 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-2">10K+</div>
              <div className="text-secondary-600 dark:text-secondary-300">Active Users</div>
            </div>
            <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <div className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-2">85%</div>
              <div className="text-secondary-600 dark:text-secondary-300">Success Rate</div>
            </div>
            <div className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <div className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-2">1M+</div>
              <div className="text-secondary-600 dark:text-secondary-300">Tasks Completed</div>
            </div>
            <div className="animate-fade-in" style={{ animationDelay: '0.5s' }}>
              <div className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-2">30</div>
              <div className="text-secondary-600 dark:text-secondary-300">Day Commitment</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 bg-primary-50 dark:bg-secondary-900 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-secondary-900 dark:text-white mb-12 animate-fade-in">
            Everything You Need, Always Free
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white dark:bg-secondary-800 rounded-xl p-6 text-center transform hover:scale-105 transition-all duration-300 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="bg-primary-100 dark:bg-primary-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 animate-float">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-primary-600 dark:text-primary-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-secondary-800 dark:text-white">Unlimited Tasks</h3>
              <p className="text-secondary-600 dark:text-secondary-300">
                Create as many tasks as you need. No limits, no restrictions - just pure habit-building power.
              </p>
            </div>
            
            {/* Feature 2 */}
            <div className="bg-white dark:bg-secondary-800 rounded-xl p-6 text-center transform hover:scale-105 transition-all duration-300 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <div className="bg-primary-100 dark:bg-primary-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 animate-float" style={{ animationDelay: '0.2s' }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-primary-600 dark:text-primary-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-secondary-800 dark:text-white">Advanced Analytics</h3>
              <p className="text-secondary-600 dark:text-secondary-300">
                Get detailed insights into your habits with comprehensive analytics and progress tracking.
              </p>
            </div>
            
            {/* Feature 3 */}
            <div className="bg-white dark:bg-secondary-800 rounded-xl p-6 text-center transform hover:scale-105 transition-all duration-300 animate-fade-in" style={{ animationDelay: '0.6s' }}>
              <div className="bg-primary-100 dark:bg-primary-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 animate-float" style={{ animationDelay: '0.4s' }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-primary-600 dark:text-primary-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-secondary-800 dark:text-white">Custom Categories</h3>
              <p className="text-secondary-600 dark:text-secondary-300">
                Organize your tasks with custom categories to better manage different areas of your life.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 bg-white dark:bg-secondary-800 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-secondary-900 dark:text-white mb-12 animate-fade-in">
            What Our Users Say
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Testimonial 1 */}
            <div className="bg-primary-50 dark:bg-secondary-700 rounded-xl p-6 transform hover:scale-105 transition-all duration-300 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center mb-4">
                <div className="h-12 w-12 rounded-full bg-primary-500 dark:bg-primary-400 flex items-center justify-center text-white font-bold">
                  S
                </div>
                <div className="ml-4">
                  <h4 className="font-semibold text-secondary-800 dark:text-white">Sarah Johnson</h4>
                  <p className="text-sm text-secondary-600 dark:text-secondary-300">Fitness Enthusiast</p>
                </div>
              </div>
              <p className="text-secondary-600 dark:text-secondary-300 italic">
                "Rituo has completely transformed my morning routine. The 30-day commitment system kept me accountable, and now I can't imagine starting my day without my new habits."
              </p>
            </div>
            
            {/* Testimonial 2 */}
            <div className="bg-primary-50 dark:bg-secondary-700 rounded-xl p-6 transform hover:scale-105 transition-all duration-300 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <div className="flex items-center mb-4">
                <div className="h-12 w-12 rounded-full bg-primary-500 dark:bg-primary-400 flex items-center justify-center text-white font-bold">
                  M
                </div>
                <div className="ml-4">
                  <h4 className="font-semibold text-secondary-800 dark:text-white">Michael Chen</h4>
                  <p className="text-sm text-secondary-600 dark:text-secondary-300">Software Developer</p>
                </div>
              </div>
              <p className="text-secondary-600 dark:text-secondary-300 italic">
                "As a developer, I needed a way to track my coding practice. Rituo's analytics helped me see patterns in my productivity and maintain a consistent schedule."
              </p>
            </div>
            
            {/* Testimonial 3 */}
            <div className="bg-primary-50 dark:bg-secondary-700 rounded-xl p-6 transform hover:scale-105 transition-all duration-300 animate-fade-in" style={{ animationDelay: '0.6s' }}>
              <div className="flex items-center mb-4">
                <div className="h-12 w-12 rounded-full bg-primary-500 dark:bg-primary-400 flex items-center justify-center text-white font-bold">
                  E
                </div>
                <div className="ml-4">
                  <h4 className="font-semibold text-secondary-800 dark:text-white">Emma Rodriguez</h4>
                  <p className="text-sm text-secondary-600 dark:text-secondary-300">Student</p>
                </div>
              </div>
              <p className="text-secondary-600 dark:text-secondary-300 italic">
                "The daily reset feature is perfect for my study schedule. I can track my progress and stay motivated throughout the semester. Highly recommend!"
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-white dark:bg-secondary-800 transition-colors duration-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-secondary-900 dark:text-white mb-12 animate-fade-in">
            Frequently Asked Questions
          </h2>
          
          <div className="space-y-6">
            {/* FAQ Item 1 */}
            <div className="bg-primary-50 dark:bg-secondary-700 rounded-xl p-6 transform hover:scale-[1.02] transition-all duration-300 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <h3 className="text-lg font-semibold text-secondary-800 dark:text-white mb-2">What is the 30-day commitment system?</h3>
              <p className="text-secondary-600 dark:text-secondary-300">
                The 30-day commitment system is a proven method for habit formation. When you create a task, you commit to completing it every day for 30 days. This creates consistency and helps build lasting habits.
              </p>
            </div>
            
            {/* FAQ Item 2 */}
            <div className="bg-primary-50 dark:bg-secondary-700 rounded-xl p-6 transform hover:scale-[1.02] transition-all duration-300 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <h3 className="text-lg font-semibold text-secondary-800 dark:text-white mb-2">Can I change my tasks during the 30-day period?</h3>
              <p className="text-secondary-600 dark:text-secondary-300">
                No, tasks are locked in for the full 30 days to maintain consistency. However, you can add new tasks at any time, and they will start their own 30-day commitment period.
              </p>
            </div>
            
            {/* FAQ Item 3 */}
            <div className="bg-primary-50 dark:bg-secondary-700 rounded-xl p-6 transform hover:scale-[1.02] transition-all duration-300 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <h3 className="text-lg font-semibold text-secondary-800 dark:text-white mb-2">What happens if I miss a day?</h3>
              <p className="text-secondary-600 dark:text-secondary-300">
                Missing a day doesn't mean failure! Your streak will reset, but you can start a new streak the next day. The important thing is to keep going and maintain consistency.
              </p>
            </div>
            
            {/* FAQ Item 4 */}
            <div className="bg-primary-50 dark:bg-secondary-700 rounded-xl p-6 transform hover:scale-[1.02] transition-all duration-300 animate-fade-in" style={{ animationDelay: '0.5s' }}>
              <h3 className="text-lg font-semibold text-secondary-800 dark:text-white mb-2">How do the analytics work?</h3>
              <p className="text-secondary-600 dark:text-secondary-300">
                Our analytics track your completion rates, streaks, and patterns over time. You can see your progress through visual charts and identify your most productive times and days.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary-600 dark:bg-primary-700 text-white transition-colors duration-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 animate-fade-in">Ready to Transform Your Daily Routine?</h2>
          <p className="text-xl mb-8 max-w-3xl mx-auto animate-fade-in" style={{ animationDelay: '0.2s' }}>
            Join thousands of people who have already changed their lives with Rituo's 30-day commitment system. Start your journey today - completely free!
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <Link to="/register" className="btn bg-white text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-200 px-8 py-3 text-lg font-medium transform hover:scale-105 active:scale-95 transition-all duration-200">
              Create Free Account
            </Link>
            <Link to="/login" className="btn bg-primary-700 hover:bg-primary-800 text-white px-8 py-3 text-lg font-medium transform hover:scale-105 active:scale-95 transition-all duration-200">
              Login
            </Link>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="bg-secondary-900 text-secondary-400 py-12 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-6 md:mb-0">
              <span className="font-display text-xl font-bold text-white">Rituo</span>
              <p className="mt-2">Build lasting habits through commitment</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-8">
              <div>
                <h3 className="text-white font-medium mb-3">Product</h3>
                <ul className="space-y-2">
                  <li><a href="#features" className="hover:text-white transition-colors duration-200">Features</a></li>
                  <li><a href="#faq" className="hover:text-white transition-colors duration-200">FAQ</a></li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-white font-medium mb-3">Company</h3>
                <ul className="space-y-2">
                  <li><a href="#about" className="hover:text-white transition-colors duration-200">About Us</a></li>
                  <li><a href="#contact" className="hover:text-white transition-colors duration-200">Contact</a></li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-white font-medium mb-3">Legal</h3>
                <ul className="space-y-2">
                  <li><a href="#privacy" className="hover:text-white transition-colors duration-200">Privacy Policy</a></li>
                  <li><a href="#terms" className="hover:text-white transition-colors duration-200">Terms of Service</a></li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-secondary-800 text-center">
            <p>&copy; {new Date().getFullYear()} Rituo. All rights reserved.</p>
            <div className="mt-4">
              <a 
                href="https://miricledev.github.io/md-landing-page/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 text-sm font-medium transition-all duration-300 hover:shadow-[0_0_15px_rgba(14,165,233,0.5)] dark:hover:shadow-[0_0_15px_rgba(56,189,248,0.5)] hover:scale-105"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Developed by miricledev
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;