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
    <div className="space-y-8">
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
    </div>
  );
};

export default CourseTabSection;
