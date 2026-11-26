import axios from 'axios';

export const CHALLENGE_AI_BATCH_SIZE = 8;

const chunk = (items, size) => {
  const batches = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
};

export const generatePersonalizedHabitBatches = async ({
  groupId,
  text,
  memberIds,
  presetHabits = [],
  onProgress,
}) => {
  const uniqueMemberIds = [...new Set((memberIds || []).map((memberId) => String(memberId)))];
  if (!uniqueMemberIds.length) {
    throw new Error('Select at least one student.');
  }

  const batches = chunk(uniqueMemberIds, CHALLENGE_AI_BATCH_SIZE);
  const studentHabitSets = [];
  const summaries = [];
  const warnings = [];
  let completedStudents = 0;

  onProgress?.({
    status: 'starting',
    completedStudents,
    totalStudents: uniqueMemberIds.length,
    batchNumber: 0,
    totalBatches: batches.length,
  });

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const batchMemberIds = batches[batchIndex];
    onProgress?.({
      status: 'generating',
      completedStudents,
      totalStudents: uniqueMemberIds.length,
      batchNumber: batchIndex + 1,
      totalBatches: batches.length,
    });

    const response = await axios.post(`/groups/${groupId}/ai-habits`, {
      text,
      memberIds: batchMemberIds,
      presetHabits,
    });
    const draft = response.data?.draft || {};
    const returnedSets = draft.studentHabitSets || [];
    const completeIds = new Set(
      returnedSets
        .filter((studentSet) => studentSet.habits?.length)
        .map((studentSet) => String(studentSet.studentId))
    );
    const missingIds = batchMemberIds.filter((memberId) => !completeIds.has(String(memberId)));
    if (missingIds.length) {
      throw new Error(
        `AI omitted ${missingIds.length} student${missingIds.length === 1 ? '' : 's'} in batch ${batchIndex + 1}. No partial habits were applied.`
      );
    }

    studentHabitSets.push(...returnedSets);
    if (draft.summary) summaries.push(draft.summary);
    warnings.push(...(draft.warnings || []));
    completedStudents += batchMemberIds.length;
    onProgress?.({
      status: batchIndex === batches.length - 1 ? 'complete' : 'generating',
      completedStudents,
      totalStudents: uniqueMemberIds.length,
      batchNumber: batchIndex + 1,
      totalBatches: batches.length,
    });
  }

  return {
    summary: summaries.join(' ').trim(),
    studentHabitSets,
    warnings: warnings.slice(0, 12),
  };
};
