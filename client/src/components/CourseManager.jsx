import React, { useState, useEffect } from 'react';
import axios from 'axios';
import InlineToast from './InlineToast';
import ConfirmModal from './ConfirmModal';

/** Group leader: create/edit courses, sections, videos, quizzes */
const CourseManager = ({ groupId, onCoursesChange }) => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [showCreateSection, setShowCreateSection] = useState(false);
  const [showAddItem, setShowAddItem] = useState(null); // sectionId
  const [addItemType, setAddItemType] = useState('video'); // 'video' | 'quiz'
  const [formCourse, setFormCourse] = useState({ name: '', description: '', settings: { verticalScroll: true, autoplay: true } });
  const [formSection, setFormSection] = useState({ title: '', description: '' });
  const [formVideo, setFormVideo] = useState({ url: '', durationSeconds: 60, thumbnailUrl: '' });
  const [formQuiz, setFormQuiz] = useState({ questions: [{ question: '', options: ['', ''], correctIndex: 0 }] });
  const [toast, setToast] = useState(null);
  const [courseToDelete, setCourseToDelete] = useState(null);

  const fetchCourses = async () => {
    try {
      const res = await axios.get('/groups/leader/courses');
      setCourses(res.data.courses || []);
      onCoursesChange?.(res.data.courses);
    } catch (e) {
      console.error('Fetch courses error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`/groups/${groupId}/courses`, formCourse);
      setFormCourse({ name: '', description: '', settings: { verticalScroll: true, autoplay: true } });
      setShowCreateCourse(false);
      setToast({ type: 'success', title: 'Course created' });
      fetchCourses();
    } catch (e) {
      setToast({ type: 'error', title: 'Failed to create course', message: e.response?.data?.error || 'Please try again.' });
    }
  };

  const handleCreateSection = async (e) => {
    e.preventDefault();
    if (!selectedCourse) return;
    const courseGroupId = selectedCourse.groupId || groupId;
    try {
      await axios.post(`/groups/${courseGroupId}/courses/${selectedCourse.id}/sections`, formSection);
      setFormSection({ title: '', description: '' });
      setShowCreateSection(false);
      setToast({ type: 'success', title: 'Section added' });
      fetchCourses();
      const res = await axios.get(`/groups/${courseGroupId}/courses/${selectedCourse.id}`);
      setSelectedCourse({ ...res.data.course, groupId: courseGroupId, groupName: selectedCourse.groupName });
    } catch (e) {
      setToast({ type: 'error', title: 'Failed to add section', message: e.response?.data?.error || 'Please try again.' });
    }
  };

  const handleAddVideo = async (e) => {
    e.preventDefault();
    if (!showAddItem) return;
    const courseGroupId = selectedCourse?.groupId || groupId;
    try {
      await axios.post(`/groups/${courseGroupId}/sections/${showAddItem}/items`, {
        itemType: 'video',
        data: formVideo
      });
      setFormVideo({ url: '', durationSeconds: 60, thumbnailUrl: '' });
      setShowAddItem(null);
      setToast({ type: 'success', title: 'Video added' });
      if (selectedCourse) {
        const res = await axios.get(`/groups/${courseGroupId}/courses/${selectedCourse.id}`);
        setSelectedCourse({ ...res.data.course, groupId: courseGroupId, groupName: selectedCourse.groupName });
      }
      fetchCourses();
    } catch (e) {
      setToast({ type: 'error', title: 'Failed to add video', message: e.response?.data?.error || 'Please try again.' });
    }
  };

  const handleAddQuiz = async (e) => {
    e.preventDefault();
    if (!showAddItem) return;
    const validQuestions = formQuiz.questions.filter(q => q.question.trim() && q.options.some(o => o.trim()));
    if (validQuestions.length === 0) {
      setToast({ type: 'error', title: 'Quiz incomplete', message: 'Add at least one question with options.' });
      return;
    }
    const courseGroupId = selectedCourse?.groupId || groupId;
    try {
      await axios.post(`/groups/${courseGroupId}/sections/${showAddItem}/items`, {
        itemType: 'quiz',
        data: { questions: validQuestions }
      });
      setFormQuiz({ questions: [{ question: '', options: ['', ''], correctIndex: 0 }] });
      setShowAddItem(null);
      setToast({ type: 'success', title: 'Quiz added' });
      if (selectedCourse) {
        const res = await axios.get(`/groups/${courseGroupId}/courses/${selectedCourse.id}`);
        setSelectedCourse({ ...res.data.course, groupId: courseGroupId, groupName: selectedCourse.groupName });
      }
      fetchCourses();
    } catch (e) {
      setToast({ type: 'error', title: 'Failed to add quiz', message: e.response?.data?.error || 'Please try again.' });
    }
  };

  const deleteCourse = async (id) => {
    const course = courses.find(c => c.id === id);
    const courseGroupId = course?.groupId || groupId;
    try {
      await axios.delete(`/groups/${courseGroupId}/courses/${id}`);
      setSelectedCourse(null);
      fetchCourses();
      setCourseToDelete(null);
      setToast({ type: 'success', title: 'Course deleted' });
    } catch (e) {
      setToast({ type: 'error', title: 'Failed to delete course', message: e.response?.data?.error || 'Please try again.' });
    }
  };

  if (loading) return <div className="p-8 text-center">Loading courses…</div>;

  return (
    <div className="space-y-6">
      {toast && <InlineToast toast={toast} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-secondary-900 dark:text-white">📚 Courses</h2>
        <button
          onClick={() => { setShowCreateCourse(true); setSelectedCourse(null); }}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium"
        >
          + Create Course
        </button>
      </div>

      {/* Course list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map(c => (
          <div
            key={c.id}
            className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${
              selectedCourse?.id === c.id
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-secondary-700 hover:border-primary-300'
            }`}
            onClick={() => {
              setSelectedCourse(c);
              setShowCreateSection(false);
              setShowAddItem(null);
            }}
          >
            <div className="font-semibold text-secondary-900 dark:text-white">{c.name}</div>
            <div className="text-sm text-secondary-500 dark:text-secondary-400 mt-1">
              {c.sections?.length || 0} section(s){c.groupName ? ` · ${c.groupName}` : ''}
            </div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={(ev) => { ev.stopPropagation(); setSelectedCourse(c); }}
                className="text-sm text-primary-600 dark:text-primary-400"
              >
                Edit
              </button>
              <button
                onClick={(ev) => { ev.stopPropagation(); setCourseToDelete(c.id); }}
                className="text-sm text-red-600 dark:text-red-400"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create course modal */}
      {showCreateCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-secondary-800 rounded-xl max-w-lg w-full p-6">
            <h3 className="text-xl font-semibold mb-4">Create Course</h3>
            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={formCourse.name}
                  onChange={e => setFormCourse({ ...formCourse, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-secondary-700 dark:border-secondary-600"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formCourse.description}
                  onChange={e => setFormCourse({ ...formCourse, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-secondary-700 dark:border-secondary-600"
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={formCourse.settings?.verticalScroll} onChange={e => setFormCourse({
                    ...formCourse, settings: { ...formCourse.settings, verticalScroll: e.target.checked }
                  })} />
                  <span className="text-sm">TikTok-style scroll</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={formCourse.settings?.autoplay} onChange={e => setFormCourse({
                    ...formCourse, settings: { ...formCourse.settings, autoplay: e.target.checked }
                  })} />
                  <span className="text-sm">Autoplay</span>
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreateCourse(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selected course: sections and items */}
      {selectedCourse && (
        <div className="bg-white dark:bg-secondary-800 rounded-xl border border-gray-200 dark:border-secondary-700 p-6">
          <h3 className="text-lg font-semibold mb-4">{selectedCourse.name}</h3>
          <button onClick={() => setShowCreateSection(true)} className="mb-4 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm">
            + Add Section
          </button>

          {showCreateSection && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-secondary-700 rounded-lg">
              <form onSubmit={handleCreateSection} className="space-y-3">
                <input
                  type="text"
                  placeholder="Section title"
                  value={formSection.title}
                  onChange={e => setFormSection({ ...formSection, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-secondary-600"
                  required
                />
                <textarea
                  placeholder="Description"
                  value={formSection.description}
                  onChange={e => setFormSection({ ...formSection, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-secondary-600"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button type="submit" className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm">Add</button>
                  <button type="button" onClick={() => setShowCreateSection(false)} className="px-3 py-1.5 border rounded-lg text-sm">Cancel</button>
                </div>
              </form>
            </div>
          )}

          <div className="space-y-4">
            {(selectedCourse.sections || []).map((sec, idx) => (
              <div key={sec.id} className="border rounded-lg p-4 dark:border-secondary-600">
                <div className="font-medium text-secondary-900 dark:text-white">
                  Week {idx + 1}: {sec.title}
                </div>
                {sec.description && <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-1">{sec.description}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {(sec.items || []).map(item => (
                    <span key={item.id} className="px-2 py-1 rounded bg-gray-200 dark:bg-secondary-600 text-xs">
                      {item.itemType === 'video' ? '🎬 Video' : '❓ Quiz'}
                    </span>
                  ))}
                  <button
                    onClick={() => { setShowAddItem(sec.id); setAddItemType('video'); }}
                    className="px-2 py-1 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs"
                  >
                    + Add
                  </button>
                </div>

                {showAddItem === sec.id && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-secondary-700 rounded-lg">
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setAddItemType('video')}
                        className={`px-3 py-1 rounded text-sm ${addItemType === 'video' ? 'bg-primary-600 text-white' : 'bg-gray-300 dark:bg-secondary-600'}`}
                      >
                        Video
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddItemType('quiz')}
                        className={`px-3 py-1 rounded text-sm ${addItemType === 'quiz' ? 'bg-primary-600 text-white' : 'bg-gray-300 dark:bg-secondary-600'}`}
                      >
                        Quiz
                      </button>
                    </div>
                    {addItemType === 'video' && (
                    <form onSubmit={handleAddVideo} className="space-y-2">
                      <input
                        type="url"
                        placeholder="Video URL (YouTube, Vimeo, etc.)"
                        value={formVideo.url}
                        onChange={e => setFormVideo({ ...formVideo, url: e.target.value })}
                        className="w-full px-3 py-2 border rounded dark:bg-secondary-600"
                      />
                      <input
                        type="number"
                        placeholder="Duration (seconds)"
                        value={formVideo.durationSeconds}
                        onChange={e => setFormVideo({ ...formVideo, durationSeconds: parseInt(e.target.value) || 0 })}
                        className="w-32 px-3 py-2 border rounded dark:bg-secondary-600"
                      />
                      <div className="flex gap-2">
                        <button type="submit" className="px-3 py-1.5 bg-primary-600 text-white rounded text-sm">Add Video</button>
                        <button type="button" onClick={() => setShowAddItem(null)} className="px-3 py-1.5 border rounded text-sm">Cancel</button>
                      </div>
                    </form>
                    )}
                    {addItemType === 'quiz' && (
                    <form onSubmit={handleAddQuiz} className="space-y-2">
                      {formQuiz.questions.map((q, qi) => (
                        <div key={qi} className="p-2 border rounded dark:border-secondary-600">
                          <input
                            type="text"
                            placeholder="Question"
                            value={q.question}
                            onChange={e => {
                              const qs = [...formQuiz.questions];
                              qs[qi] = { ...q, question: e.target.value };
                              setFormQuiz({ questions: qs });
                            }}
                            className="w-full px-2 py-1 border rounded text-sm dark:bg-secondary-600"
                          />
                          {q.options.map((opt, oi) => (
                            <input
                              key={oi}
                              type="text"
                              placeholder={`Option ${oi + 1}`}
                              value={opt}
                              onChange={e => {
                                const qs = [...formQuiz.questions];
                                const opts = [...qs[qi].options];
                                opts[oi] = e.target.value;
                                qs[qi] = { ...qs[qi], options: opts };
                                setFormQuiz({ questions: qs });
                              }}
                              className="w-full mt-1 px-2 py-1 border rounded text-sm dark:bg-secondary-600"
                            />
                          ))}
                          <select
                            value={q.correctIndex}
                            onChange={e => {
                              const qs = [...formQuiz.questions];
                              qs[qi] = { ...q, correctIndex: parseInt(e.target.value) };
                              setFormQuiz({ questions: qs });
                            }}
                            className="mt-1 text-sm"
                          >
                            {q.options.map((_, oi) => (
                              <option key={oi} value={oi}>Correct: Option {oi + 1}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormQuiz({ questions: [...formQuiz.questions, { question: '', options: ['', ''], correctIndex: 0 }] })}
                          className="text-sm text-primary-600"
                        >
                          + Add question
                        </button>
                        <button type="submit" className="px-3 py-1.5 bg-primary-600 text-white rounded text-sm">Add Quiz</button>
                        <button type="button" onClick={() => setShowAddItem(null)} className="px-3 py-1.5 border rounded text-sm">Cancel</button>
                      </div>
                    </form>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {courses.length === 0 && !showCreateCourse && (
        <div className="text-center py-12 text-secondary-500 dark:text-secondary-400">
          No courses yet. Create one to add TikTok-style videos and quizzes for your students.
        </div>
      )}

      {courseToDelete && (
        <ConfirmModal
          title="Delete course?"
          message="This course and all of its sections, videos, and quizzes will be deleted. This cannot be undone."
          cancelLabel="Cancel"
          confirmLabel="Delete"
          onCancel={() => setCourseToDelete(null)}
          onConfirm={() => deleteCourse(courseToDelete)}
        />
      )}
    </div>
  );
};

export default CourseManager;
