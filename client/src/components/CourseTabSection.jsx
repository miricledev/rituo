import React from 'react';

const CourseTabSection = ({
  activeTab,
  isLeader,
  group,
  groupId,
  courseProgress,
  refreshCourseProgress,
  renderLazyPanel,
  CourseStudentProgress,
  CourseManager,
  CoursePlayer
}) => {
  if (activeTab !== 'course') {
    return null;
  }

  return (
    <section className="space-y-8 rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045] sm:p-6">
      {isLeader ? (
        renderLazyPanel(
          <>
            {group?.activeChallenge?.courseId && (
              <CourseStudentProgress
                groupId={groupId}
                challengeId={group.activeChallenge.id}
                course={group.activeChallenge.course}
              />
            )}
            <CourseManager groupId={groupId} />
          </>
        )
      ) : group?.activeChallenge?.courseId ? (
        courseProgress?.mustComplete === false ? (
          <div className="text-center py-12 text-secondary-500 dark:text-secondary-400">
            You're not required to complete this course.
          </div>
        ) : courseProgress?.course ? (
          renderLazyPanel(
            <CoursePlayer
              groupId={groupId}
              challengeId={group.activeChallenge.id}
              course={courseProgress.course}
              progress={courseProgress.progress}
              endDate={courseProgress.endDate}
              joinedAt={courseProgress.joinedAt}
              onProgress={refreshCourseProgress}
            />
          )
        ) : (
          <div className="text-center py-12">Loading course...</div>
        )
      ) : (
        <div className="text-center py-12 text-secondary-500 dark:text-secondary-400">
          No course for this challenge. Your group leader can add one when creating a challenge.
        </div>
      )}
    </section>
  );
};

export default CourseTabSection;
