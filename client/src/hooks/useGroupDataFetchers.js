import { useCallback } from 'react';
import axios from 'axios';

const useGroupDataFetchers = ({
  group,
  groupId,
  user,
  setGroup,
  setLoading,
  setError,
  setSchoolProfiles,
  setLeagueTable,
  setSchoolProfilesLoading,
  setArchives,
  setArchivesLoading,
  setAttendance,
  setAttendanceLoading,
  setConversations,
  setConversationsLoading
}) => {
  const fetchSchoolProfiles = useCallback(async () => {
    try {
      setSchoolProfilesLoading(true);
      const response = await axios.get(`/groups/${groupId}/school-profiles`);
      setSchoolProfiles(response.data.profiles || []);
      setLeagueTable(response.data.leagueTable || []);
    } catch (error) {
      console.error('Error fetching school profiles:', error);
      setSchoolProfiles([]);
      setLeagueTable([]);
    } finally {
      setSchoolProfilesLoading(false);
    }
  }, [groupId, setLeagueTable, setSchoolProfiles, setSchoolProfilesLoading]);

  const fetchGroupDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/groups/${groupId}`);
      const fetchedGroup = response.data.group;
      if (fetchedGroup) {
        setGroup({
          ...fetchedGroup,
          groupType: fetchedGroup.groupType || 'school'
        });
        fetchSchoolProfiles();
      } else {
        setGroup(null);
      }
    } catch (error) {
      console.error('Error fetching group details:', error);
      setError('Failed to load group details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [fetchSchoolProfiles, groupId, setError, setGroup, setLoading]);

  const fetchArchives = useCallback(async () => {
    try {
      setArchivesLoading(true);
      const response = await axios.get(`/groups/${groupId}/archives`);
      setArchives(response.data.archives);
    } catch (error) {
      console.error('Error fetching archives:', error);
    } finally {
      setArchivesLoading(false);
    }
  }, [groupId, setArchives, setArchivesLoading]);

  const fetchAttendance = useCallback(async () => {
    try {
      setAttendanceLoading(true);
      const response = await axios.get(`/groups/${groupId}/attendance`);
      setAttendance(response.data.attendance || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setAttendance([]);
    } finally {
      setAttendanceLoading(false);
    }
  }, [groupId, setAttendance, setAttendanceLoading]);

  const fetchConversations = useCallback(async () => {
    try {
      setConversationsLoading(true);
      const otherMembers = group?.members?.filter((member) => member.id !== user?.id) || [];

      const conversationPromises = otherMembers.map(async (member) => {
        try {
          const response = await axios.get(`/groups/${groupId}/dm/${member.id}`);
          const messages = response.data.messages || [];
          const latestMessage = messages[messages.length - 1];
          const unreadCount = messages.filter(
            (message) => message.sender_id !== user?.id && !message.read_by?.includes(user?.id)
          ).length;

          return {
            id: member.id,
            username: member.username,
            avatar: member.username?.[0]?.toUpperCase() || '?',
            latestMessage: latestMessage?.content || 'No messages yet',
            timestamp: latestMessage?.created_at || null,
            unreadCount,
            isOnline: false
          };
        } catch (error) {
          return {
            id: member.id,
            username: member.username,
            avatar: member.username?.[0]?.toUpperCase() || '?',
            latestMessage: 'No messages yet',
            timestamp: null,
            unreadCount: 0,
            isOnline: false
          };
        }
      });

      const conversationResults = await Promise.all(conversationPromises);
      conversationResults.sort((a, b) => {
        if (!a.timestamp && !b.timestamp) return 0;
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });

      setConversations(conversationResults);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setConversationsLoading(false);
    }
  }, [group, groupId, setConversations, setConversationsLoading, user?.id]);

  const fetchMyCoachAssignments = useCallback(async () => {
    if (!user?.id) return [];
    try {
      const response = await axios.get(`/groups/${groupId}/coaches/${user.id}/assignments`);
      return response.data.students.map((student) => student.id);
    } catch (error) {
      console.error('Error fetching coach assignments:', error);
      return [];
    }
  }, [groupId, user?.id]);

  return {
    fetchSchoolProfiles,
    fetchGroupDetails,
    fetchArchives,
    fetchAttendance,
    fetchConversations,
    fetchMyCoachAssignments
  };
};

export default useGroupDataFetchers;
