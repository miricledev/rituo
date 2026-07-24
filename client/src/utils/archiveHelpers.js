export const getArchiveBestPerformer = (archive) => {
  if (!archive?.member_stats?.length) return 'N/A';
  return archive.member_stats.reduce((best, member) => (
    member.completion_rate > best.completion_rate ? member : best
  )).username;
};
