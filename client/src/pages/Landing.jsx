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
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-secondary-900 dark:to-secondary-800 transition-colors duration-200">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white dark:bg-secondary-800 bg-opacity-90 dark:bg-opacity-90 backdrop-blur-sm shadow-sm transition-colors duration-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <a href="#" className="font-display text-xl font-bold text-primary-600 dark:text-primary-400 hover:scale-105 transition-transform duration-200">
                Inner Performance
              </a>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/login" className="btn btn-primary transform hover:scale-105 active:scale-95 transition-all duration-200">
                Log In
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <main className="flex-1 flex flex-col">
        {/* Hero Section */}
        <section className="min-h-screen pt-32 pb-24 px-4 flex items-center justify-center">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-secondary-900 dark:text-white mb-6 animate-fade-in">
              Transform Your Daily Routine
            </h1>
            <p className="text-xl text-secondary-700 dark:text-secondary-300 max-w-3xl mx-auto mb-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <span className="text-primary-600 dark:text-primary-400 typewriter">{text}</span>
            </p>
            <p className="text-xl text-secondary-700 dark:text-secondary-300 max-w-3xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              Inner Performance helps you create and maintain daily habits through a 30-day locked-in commitment system. Track your progress, visualize your success, and build discipline.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <Link to="/login" className="btn btn-primary text-lg px-8 py-3 transform hover:scale-105 active:scale-95 transition-all duration-200">
                Get Started
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

        {/* Fun Fact Box */}
        <section className="py-12 bg-gradient-to-r from-primary-50 to-primary-100 dark:from-secondary-900 dark:to-secondary-800 transition-colors duration-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white dark:bg-secondary-800 rounded-2xl p-8 shadow-lg transform hover:scale-[1.02] transition-all duration-300">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="bg-primary-100 dark:bg-primary-900 rounded-full p-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-secondary-900 dark:text-white mb-2">Did You Know?</h3>
                  <p className="text-secondary-700 dark:text-secondary-300">
                    Research shows that consistently repeating a behavior for 30 days or more can help make it a lasting habit. While the exact time varies for everyone, studies suggest it takes on average 2–3 months for a new habit to become automatic.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section (Replaced) */}
        <section className="py-16 bg-white dark:bg-secondary-800 transition-colors duration-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-6 animate-fade-in">
              Your Journey Starts Here
            </h2>
            <p className="text-xl text-secondary-700 dark:text-secondary-300 mb-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Every big change begins with a single step. Inner Performance is here to help you build habits, stay accountable, and celebrate your progress—one day at a time.
            </p>
            <div className="flex justify-center animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <svg className="w-32 h-32 text-primary-200 dark:text-primary-700" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="4" />
                <path d="M32 12v20l14 8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
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
              Join Our Community
            </h2>
            <div className="flex flex-col items-center justify-center animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="bg-primary-50 dark:bg-secondary-700 rounded-xl p-8 text-center max-w-2xl">
                <h3 className="text-xl font-semibold mb-3 text-secondary-800 dark:text-white">A Place to Grow</h3>
                <p className="text-secondary-600 dark:text-secondary-300">
                  Inner Performance is more than just a habit tracker—it's a supportive space for anyone looking to build better routines. Whether you're starting your first 30-day challenge or are a seasoned habit builder, you're in good company. Join thousands of others on the journey to self-improvement!
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
              Join thousands of people who have already changed their lives with Inner Performance's 30-day commitment system. Start your journey today - completely free!
            </p>
            <div className="flex justify-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <Link to="/login" className="btn bg-white text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-200 px-8 py-3 text-lg font-medium transform hover:scale-105 active:scale-95 transition-all duration-200">
                Login
              </Link>
            </div>
          </div>
        </section>
        
        {/* About Us Section */}
        <section id="about" className="py-16 bg-primary-50 dark:bg-secondary-900 transition-colors duration-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-6 animate-fade-in">About Us</h2>
            <p className="text-xl text-secondary-700 dark:text-secondary-300 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Inner Performance was created by a small team passionate about helping people build better habits. Our mission is to make habit formation simple, motivating, and accessible to everyone.
            </p>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="py-16 bg-white dark:bg-secondary-800 transition-colors duration-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-6 animate-fade-in">Contact</h2>
            <p className="text-xl text-secondary-700 dark:text-secondary-300 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Have questions, feedback, or need support? Email us at <a href="mailto:support@innerperformance.app" className="text-primary-600 dark:text-primary-400 underline">support@innerperformance.app</a> and we'll get back to you as soon as possible.
            </p>
          </div>
        </section>

        {/* Privacy Policy Section */}
        <section id="privacy" className="py-16 bg-primary-50 dark:bg-secondary-900 transition-colors duration-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-6 animate-fade-in">Privacy Policy</h2>
            <p className="text-xl text-secondary-700 dark:text-secondary-300 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              We respect your privacy. Inner Performance does not sell your data or share your personal information with third parties. For full details, please review our complete privacy policy (coming soon).
            </p>
          </div>
        </section>

        {/* Terms of Service Section */}
        <section id="terms" className="py-16 bg-white dark:bg-secondary-800 transition-colors duration-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-6 animate-fade-in">Terms of Service</h2>
            <p className="text-xl text-secondary-700 dark:text-secondary-300 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              By using Inner Performance, you agree to our terms of service. Please use the platform responsibly and respectfully. Full terms will be available here soon.
            </p>
          </div>
        </section>
      </main>
      {/* Footer (moved to always be last, outside <main>) */}
      <footer className="bg-secondary-900 text-secondary-400 py-12 transition-colors duration-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-6 md:mb-0">
              <span className="font-display text-xl font-bold text-white">Inner Performance</span>
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
            <p>&copy; {new Date().getFullYear()} Inner Performance. All rights reserved.</p>
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