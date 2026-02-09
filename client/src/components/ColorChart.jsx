import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const ColorChart = ({ memberHabit, isLeader, isCoach = false, groupId: propGroupId, groupType: propGroupType }) => {
  const params = useParams();
  const routeGroupId = params.groupId;
  const groupId = propGroupId ?? routeGroupId;
  // Handle both cases: memberHabit.member could be a string ID, number ID, or an object with id
  const memberId = typeof memberHabit?.member === 'string' || typeof memberHabit?.member === 'number'
    ? memberHabit.member 
    : memberHabit?.member?.id;
  
  // Default color scheme
  const [colorScheme, setColorScheme] = useState({
    unstarted: '#ffffff', // white for unstarted blocks
    urgent: '#ef4444', // red
    development: '#f97316', // orange
    growth: '#eab308', // yellow
    aboveAverage: '#84cc16', // light green
    excellent: '#22c55e' // dark green
  });
  const [resolvedGroupType, setResolvedGroupType] = useState(propGroupType || 'school');
  const [isEditingColors, setIsEditingColors] = useState(false);
  const [isEditingSkills, setIsEditingSkills] = useState(false);
  const [skillLevels, setSkillLevels] = useState({}); // Store custom skill levels
  const [activeTerm, setActiveTerm] = useState('autumn1'); // 'autumn1', 'autumn2', 'spring1', 'spring2', 'summer1', 'summer2'
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editHistory, setEditHistory] = useState({}); // { cellKey: { editorId, editorName, editedAt } }
  const [lastEditedBy, setLastEditedBy] = useState(null); // { id, username }
  const [lastEditedAt, setLastEditedAt] = useState(null);
  const [editedCells, setEditedCells] = useState([]); // Track cells edited in current session
  const [colorsEdited, setColorsEdited] = useState(false); // Track if colors were edited by user
  const [hoveredCell, setHoveredCell] = useState(null); // Track which cell is being hovered for tooltip
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 }); // Tooltip position
  const [showAllTerms, setShowAllTerms] = useState(false); // Toggle between current term and all terms view
  const [allTermsData, setAllTermsData] = useState({}); // Store data for all terms
  const [chartVisibleSkills, setChartVisibleSkills] = useState({}); // { skillName: true/false } - which skills to show on line chart
  const hasFetchedGroupTypeRef = useRef(!!propGroupType);
  const previousGroupTypeRef = useRef(resolvedGroupType);
  const previousTermRef = useRef(null); // Track previous term to save before switching
  const isSwitchingTermRef = useRef(false); // Flag to prevent auto-save during term switch
  const pendingOperationRef = useRef(null); // Track pending save/load operations to prevent rapid switches
  const isLoadingDataRef = useRef(false); // Flag to prevent auto-save during data loading

  useEffect(() => {
    if (propGroupType) {
      setResolvedGroupType(propGroupType);
      hasFetchedGroupTypeRef.current = true;
    }
  }, [propGroupType]);

  // Term configuration with block counts
  const termConfig = useMemo(() => {
    if (resolvedGroupType === 'football') {
      return {
        january: { name: 'January', blocks: 4, dates: 'Approx. 4 weeks' },
        february: { name: 'February', blocks: 4, dates: 'Approx. 4 weeks' },
        march: { name: 'March', blocks: 5, dates: 'Approx. 5 weeks' },
        april: { name: 'April', blocks: 4, dates: 'Approx. 4 weeks' },
        may: { name: 'May', blocks: 5, dates: 'Approx. 5 weeks' },
        june: { name: 'June', blocks: 4, dates: 'Approx. 4 weeks' },
        july: { name: 'July', blocks: 4, dates: 'Approx. 4 weeks' },
        august: { name: 'August', blocks: 4, dates: 'Approx. 4 weeks' },
        september: { name: 'September', blocks: 5, dates: 'Approx. 5 weeks' },
        october: { name: 'October', blocks: 4, dates: 'Approx. 4 weeks' },
        november: { name: 'November', blocks: 4, dates: 'Approx. 4 weeks' },
        december: { name: 'December', blocks: 5, dates: 'Approx. 5 weeks' }
      };
    }
    return {
      autumn1: { name: 'Autumn 1', blocks: 8, dates: '1 Sep 2025 → 24 Oct 2025' },
      autumn2: { name: 'Autumn 2', blocks: 7, dates: '3 Nov 2025 → 19 Dec 2025' },
      spring1: { name: 'Spring 1', blocks: 6, dates: '6 Jan 2026 → 13 Feb 2026' },
      spring2: { name: 'Spring 2', blocks: 5, dates: '24 Feb 2026 → 27 Mar 2026' },
      summer1: { name: 'Summer 1', blocks: 6, dates: '13 Apr 2026 → 22 May 2026' },
      summer2: { name: 'Summer 2', blocks: 7, dates: '2 Jun 2026 → 20 Jul 2026' }
    };
  }, [resolvedGroupType]);

  // Order of levels from worst to best
  const levelOrder = ['urgent', 'development', 'growth', 'aboveAverage', 'excellent', 'unstarted'];

  // Distinct colors for line chart (no repeats, easy to tell apart)
  const CHART_LINE_COLORS = [
    '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#0891b2', '#ea580c', '#be185d',
    '#0d9488', '#4f46e5', '#b91c1c', '#15803d', '#a16207', '#7e22ce', '#0e7490', '#c2410c',
    '#9d174d', '#047857', '#1d4ed8', '#991b1b', '#65a30d', '#7c3aed', '#0f766e', '#c026d3',
    '#4d7c0f', '#6366f1', '#0d9488', '#e11d48', '#84cc16', '#8b5cf6'
  ];

  // Skill categories and skills based on the image structure
  const skillCategories = useMemo(() => {
    if (resolvedGroupType === 'football') {
      return [
        {
          name: 'TECHNICAL (BRAIN)',
          skills: [
            'Movement',
            'Receiving & Control',
            'Passing',
            'Dribbling',
            'Shooting & Finishing',
            'Turning & Ball Protection',
            'Attacking',
            'Defending'
          ]
        },
        {
          name: 'PSYCHOLOGICAL (HEART)',
          skills: [
            'Self Confidence',
            'Emotional Control',
            'Mental Toughness',
            'Attitude',
            'Focus & Concentration',
            'Trust',
            'Coachability',
            'Desire'
          ]
        },
        {
          name: 'PHYSICAL (GUT)',
          skills: [
            'Balance',
            'Co-ordination',
            'Agility',
            'Speed',
            'Strength',
            'Power / Explosiveness',
            'Flexibility',
            'Reaction Time'
          ]
        }
      ];
    }

    return [
      {
        name: 'TECHNICAL (BRAIN)',
        skills: [
          'Problem solving',
          'Concentration',
          'Energy',
          'Physical health',
          'Performance',
          'Discipline',
          'Imagination/Creativity',
          'Maturity',
          'Positive Reaction'
        ]
      },
      {
        name: 'EMOTIONAL (HEART)',
        skills: [
          'Self Confidence',
          'Emotional Control',
          'Mental Toughness',
          'Attitude',
          'Resilience',
          'Trust',
          'Coachability',
          'Desire',
          'Awareness'
        ]
      },
      {
        name: 'SOCIAL (GUT)',
        skills: [
          'Communication skills',
          'Leadership',
          'Respect',
          'Team Work',
          'Friendship Building',
          'Listening Skills',
          'Patience',
          'Comfort Zone'
        ]
      }
    ];
  }, [resolvedGroupType]);

  const defaultTermKey = resolvedGroupType === 'football' ? 'january' : 'autumn1';
  const activeTermConfig = termConfig[activeTerm] || termConfig[defaultTermKey] || { name: '', blocks: 0, dates: '' };

  useEffect(() => {
    const availableTerms = Object.keys(termConfig);
    const defaultTerm = resolvedGroupType === 'football' ? 'january' : 'autumn1';

    if (previousGroupTypeRef.current !== resolvedGroupType) {
      previousGroupTypeRef.current = resolvedGroupType;
      if (activeTerm !== defaultTerm) {
        setActiveTerm(defaultTerm);
      }
      return;
    }

    if (!availableTerms.includes(activeTerm)) {
      setActiveTerm(defaultTerm);
    }
  }, [resolvedGroupType, termConfig, activeTerm]);

  // API functions for loading and saving skill chart data
  const loadSkillChartData = async (term = activeTerm) => {
    if (!memberId) return;
    
    // If no groupId provided (e.g., from Dashboard), try to get user's groups
    let targetGroupId = groupId;
    if (!targetGroupId) {
      try {
        const response = await api.get('/auth/user');
        const user = response.data.user;
        if (user && user.groups && user.groups.length > 0) {
          // Use the first group the user belongs to
          const firstGroup = user.groups[0];
          targetGroupId = firstGroup.groupId;
          if (!propGroupType && firstGroup.groupType && !hasFetchedGroupTypeRef.current) {
            setResolvedGroupType(firstGroup.groupType || 'school');
            hasFetchedGroupTypeRef.current = true;
          }
        } else {
          console.log('User has no groups');
          return;
        }
      } catch (error) {
        console.error('Error fetching user groups:', error);
        return;
      }
    }

    if (!propGroupType && targetGroupId && !hasFetchedGroupTypeRef.current) {
      try {
        const groupResponse = await api.get(`/groups/${targetGroupId}`);
        const fetchedType = groupResponse.data?.group?.groupType;
        if (fetchedType) {
          setResolvedGroupType(fetchedType);
          hasFetchedGroupTypeRef.current = true;
        }
      } catch (error) {
        console.error('Error fetching group type:', error);
      }
    }
    
    setLoading(true);
    isLoadingDataRef.current = true; // Mark that we're loading data
    try {
      const response = await api.get(`/groups/${targetGroupId}/members/${memberId}/skill-charts/${term}`);
      const data = response.data;
      
      if (data.skillLevels) {
        setSkillLevels(data.skillLevels);
      }
      if (data.colorScheme) {
        setColorScheme(prev => ({
          ...prev,
          ...data.colorScheme
        }));
        // Reset colorsEdited flag when loading data - colors weren't edited by user
        setColorsEdited(false);
      }
      if (data.editHistory) {
        setEditHistory(data.editHistory);
      }
      if (data.lastEditedBy) {
        setLastEditedBy(data.lastEditedBy);
      }
      if (data.lastEditedAt) {
        setLastEditedAt(data.lastEditedAt);
      }
      // Reset edited cells when loading new data
      setEditedCells([]);
      // Reset colorsEdited flag when loading new data
      setColorsEdited(false);
    } catch (error) {
      console.error('Error loading skill chart data:', error);
      // Keep default values if loading fails
    } finally {
      setLoading(false);
      // Clear the loading flag after a short delay to ensure state updates complete
      // This prevents auto-save from triggering immediately after load
      setTimeout(() => {
        isLoadingDataRef.current = false;
      }, 100);
    }
  };

  const saveSkillChartData = async (term = activeTerm) => {
    if (!memberId || (!isLeader && !isCoach)) {
      console.log('Save skipped:', { groupId, memberId, isLeader, isCoach });
      return;
    }
    
    // If no groupId provided (e.g., from Dashboard), try to get user's groups
    let targetGroupId = groupId;
    if (!targetGroupId) {
      try {
        const response = await api.get('/auth/user');
        const user = response.data.user;
        if (user && user.groups && user.groups.length > 0) {
          // Use the first group the user belongs to
          const firstGroup = user.groups[0];
          targetGroupId = firstGroup.groupId;
          if (!propGroupType && firstGroup.groupType && !hasFetchedGroupTypeRef.current) {
            setResolvedGroupType(firstGroup.groupType || 'school');
            hasFetchedGroupTypeRef.current = true;
          }
        } else {
          console.log('User has no groups');
          return;
        }
      } catch (error) {
        console.error('Error fetching user groups:', error);
        return;
      }
    }

    if (!propGroupType && targetGroupId && !hasFetchedGroupTypeRef.current) {
      try {
        const groupResponse = await api.get(`/groups/${targetGroupId}`);
        const fetchedType = groupResponse.data?.group?.groupType;
        if (fetchedType) {
          setResolvedGroupType(fetchedType);
          hasFetchedGroupTypeRef.current = true;
        }
      } catch (error) {
        console.error('Error fetching group type:', error);
      }
    }
    
    // Filter skillLevels to only include data for the specified term
    // This prevents overwriting other terms' data when switching terms
    const termSpecificSkillLevels = {};
    Object.keys(skillLevels).forEach(key => {
      if (key.startsWith(`${term}-`)) {
        termSpecificSkillLevels[key] = skillLevels[key];
      }
    });
    
    // Don't save empty data if we're switching terms rapidly
    // If there's no data for this term in skillLevels, and we're currently loading,
    // it means we haven't loaded the data yet - don't overwrite with empty
    const hasDataForTerm = Object.keys(termSpecificSkillLevels).length > 0;
    if (!hasDataForTerm && loading && isSwitchingTermRef.current) {
      console.log('Save skipped: no data for term and switch in progress - data may not be loaded yet');
      return;
    }
    
    // Filter editedCells to only include cells for this term
    const termEditedCells = editedCells.filter(cellKey => cellKey.startsWith(`${term}-`));
    
    // Don't save if there are no actual user edits (no edited cells and no color changes)
    // This prevents saving on load when data is just being loaded from the server
    if (termEditedCells.length === 0 && !colorsEdited) {
      console.log('Save skipped: no user edits detected (no edited cells and colors not changed)');
      return;
    }
    
    console.log('Saving skill chart data:', { 
      groupId: targetGroupId, 
      memberId, 
      term, 
      totalSkillLevels: Object.keys(skillLevels).length,
      termSpecificSkillLevels: Object.keys(termSpecificSkillLevels).length,
      colorScheme,
      editedCellsCount: termEditedCells.length,
      colorsEdited
    });
    setSaving(true);
    try {
      const response = await api.put(`/groups/${targetGroupId}/members/${memberId}/skill-charts/${term}`, {
        skillLevels: termSpecificSkillLevels, // Only save data for this specific term
        colorScheme: colorScheme,
        editedCells: termEditedCells // Send array of edited cell keys
      });
      console.log('Save successful:', response.data);
      
      // Update edit history and last edited info from response
      if (response.data.skillChart) {
        if (response.data.skillChart.editHistory) {
          setEditHistory(response.data.skillChart.editHistory);
        }
        if (response.data.skillChart.lastEditedBy) {
          setLastEditedBy(response.data.skillChart.lastEditedBy);
        }
        if (response.data.skillChart.lastEditedAt) {
          setLastEditedAt(response.data.skillChart.lastEditedAt);
        }
      }
      
      // Clear edited cells after successful save
      setEditedCells(prev => prev.filter(cellKey => !cellKey.startsWith(`${term}-`)));
      // Reset colorsEdited flag after successful save
      setColorsEdited(false);
    } catch (error) {
      console.error('Error saving skill chart data:', error);
      console.error('Error details:', error.response?.data);
    } finally {
      setSaving(false);
    }
  };

  const resetSkillChartData = async (term = activeTerm) => {
    if (!groupId || !memberId || (!isLeader && !isCoach)) return;
    
    try {
      await api.post(`/groups/${groupId}/members/${memberId}/skill-charts/${term}/reset`);
      // Reload data after reset
      await loadSkillChartData(term);
    } catch (error) {
      console.error('Error resetting skill chart data:', error);
    }
  };

  // Load data when component mounts or when term changes
  useEffect(() => {
    if (!memberId) return;
    if (!termConfig[activeTerm]) return;
    
    // Set loading to true immediately to hide the chart grid
    // This prevents the old chart from showing for even a split second
    setLoading(true);
    // Set loading flag synchronously BEFORE any async operations
    // This prevents auto-save from triggering during the initial load
    isLoadingDataRef.current = true;
    
    // Don't clear skillLevels here - the loading state will hide the chart
    // Clearing would trigger auto-save and overwrite data
    
    // If we're switching terms, save the previous term's data first
    if (previousTermRef.current && previousTermRef.current !== activeTerm && (isLeader || isCoach)) {
      isSwitchingTermRef.current = true;
      const previousTerm = previousTermRef.current;
      
      // Track the pending operation to prevent rapid switches
      const operationPromise = (async () => {
        try {
          // Check if we actually have data for the previous term before saving
          // This prevents saving empty data when switching rapidly
          const hasPreviousTermData = Object.keys(skillLevels).some(key => 
            key.startsWith(`${previousTerm}-`)
          );
          
          if (hasPreviousTermData) {
            // Save previous term's data before loading new term
            // saveSkillChartData now filters by term, so we can call it safely
            // This is critical: we MUST save the previous term before loading the new one
            // to prevent data loss
            console.log('Saving previous term data before switch:', previousTerm);
            await saveSkillChartData(previousTerm);
          } else {
            console.log('Skipping save for previous term - no data in state (may not have been loaded yet)');
          }
          
          // After saving (or skipping), load the new term
          await loadSkillChartData();
        } catch (err) {
          console.error('Error during term switch operation:', err);
          // Still load new term even if save fails (user can retry)
          await loadSkillChartData();
        } finally {
          isSwitchingTermRef.current = false;
          pendingOperationRef.current = null;
        }
      })();
      
      pendingOperationRef.current = operationPromise;
    } else {
      // Normal load (mount or first term)
      const operationPromise = (async () => {
        try {
          await loadSkillChartData();
        } finally {
          pendingOperationRef.current = null;
        }
      })();
      pendingOperationRef.current = operationPromise;
    }
    
    // Update previous term reference AFTER we've handled the save
    // This ensures we always save before switching
    previousTermRef.current = activeTerm;
  }, [groupId, memberId, activeTerm, termConfig]);

  // Auto-save when skill levels or color scheme changes (with debounce)
  // NOTE: We exclude activeTerm from dependencies to prevent saving wrong term's data
  useEffect(() => {
    if (!isLeader && !isCoach) {
      console.log('Auto-save skipped: not a leader or coach');
      return;
    }
    
    // Don't auto-save if we're in the middle of switching terms
    if (isSwitchingTermRef.current) {
      console.log('Auto-save skipped: term switch in progress');
      return;
    }
    
    // Don't auto-save if we're currently loading data - this prevents saving empty/bad data
    // when the network is bad and data doesn't load properly
    if (isLoadingDataRef.current || loading) {
      console.log('Auto-save skipped: data is currently loading');
      return;
    }
    
    console.log('Auto-save effect triggered:', { skillLevels, colorScheme, activeTerm });
    const timeoutId = setTimeout(() => {
      // Double-check we're not switching terms (race condition protection)
      if (isSwitchingTermRef.current) {
        console.log('Auto-save cancelled: term switch detected during timeout');
        return;
      }
      
      // Double-check we're not loading data (race condition protection)
      if (isLoadingDataRef.current || loading) {
        console.log('Auto-save cancelled: data loading detected during timeout');
        return;
      }
      
      console.log('Auto-save timeout triggered, calling saveSkillChartData');
      // saveSkillChartData filters by activeTerm, so this is safe
      saveSkillChartData();
    }, 1000); // Auto-save after 1 second of no changes

    return () => clearTimeout(timeoutId);
  }, [skillLevels, colorScheme, loading]); // Added loading to dependencies to prevent save during load

  // Get skill level for a specific skill and block
  const getSkillLevel = (skillName, blockNumber) => {
    const key = `${activeTerm}-${skillName}-${blockNumber}`;
    
    // Check if we have a custom level set
    if (skillLevels[key]) {
      return skillLevels[key];
    }
    
    // Default to unstarted for new blocks
    return 'unstarted';
  };

  const updateSkillLevel = (skillName, blockNumber, newLevel) => {
    const key = `${activeTerm}-${skillName}-${blockNumber}`;
    setSkillLevels(prev => ({
      ...prev,
      [key]: newLevel
    }));
    // Track this cell as edited
    if (!editedCells.includes(key)) {
      setEditedCells(prev => [...prev, key]);
    }
  };

  const getNextLevel = (currentLevel) => {
    const levels = ['unstarted', 'urgent', 'development', 'growth', 'aboveAverage', 'excellent'];
    const currentIndex = levels.indexOf(currentLevel);
    const nextIndex = (currentIndex + 1) % levels.length;
    return levels[nextIndex];
  };

  const getColorForLevel = (level) => {
    return colorScheme[level] || '#6b7280'; // default gray
  };

  const getLevelName = (level) => {
    const levelNames = {
      unstarted: 'Not Started',
      urgent: 'Urgent Development',
      development: 'Area of Development',
      growth: 'Area For Growth',
      aboveAverage: 'Above Average',
      excellent: 'Excellent in this Area'
    };
    return levelNames[level] || 'Unknown';
  };

  const getLevelDescription = (level) => {
    const descriptions = {
      unstarted: 'Not yet evaluated',
      urgent: 'Developing Towards IP Standards',
      development: 'Close To IP Standards',
      growth: 'IP Standards',
      aboveAverage: 'IP Elite Standards',
      excellent: 'Academy Standards'
    };
    return descriptions[level] || '';
  };

  // Convert skill level to numeric value for chart (urgent=0, excellent=4)
  const levelToNumeric = (level) => {
    const levelMap = {
      'urgent': 0,
      'development': 1,
      'growth': 2,
      'aboveAverage': 3,
      'excellent': 4,
      'unstarted': null // Don't plot unstarted
    };
    return levelMap[level] ?? null;
  };

  // Load data for all terms
  const loadAllTermsData = async () => {
    if (!memberId) return;
    
    let targetGroupId = groupId;
    if (!targetGroupId) {
      try {
        const response = await api.get('/auth/user');
        const user = response.data.user;
        if (user && user.groups && user.groups.length > 0) {
          targetGroupId = user.groups[0].groupId;
        } else {
          return;
        }
      } catch (error) {
        console.error('Error fetching user groups:', error);
        return;
      }
    }

    const terms = Object.keys(termConfig);
    const allData = {};
    
    for (const term of terms) {
      try {
        const response = await api.get(`/groups/${targetGroupId}/members/${memberId}/skill-charts/${term}`);
        if (response.data.skillLevels) {
          allData[term] = response.data.skillLevels;
        }
      } catch (error) {
        // Term might not have data yet, that's okay
        console.log(`No data for term ${term}`);
      }
    }
    
    setAllTermsData(allData);
  };

  // Prepare chart data for line chart
  const prepareChartData = useMemo(() => {
    if (showAllTerms) {
      // Combine all terms data - calculate average across all terms for each block
      const allSkills = new Set();
      const blockDataMap = {}; // { blockNum: { skill1: value, skill2: value, ... } }
      
      // Collect all skills and blocks from all terms
      Object.entries(allTermsData).forEach(([term, termData]) => {
        const termBlocks = termConfig[term]?.blocks || 0;
        Object.keys(termData).forEach(key => {
          const parts = key.split('-');
          if (parts[0] === term) {
            const skillName = parts.slice(1, -1).join('-');
            const blockNum = parseInt(parts[parts.length - 1]);
            allSkills.add(skillName);
            
            if (blockNum <= termBlocks) {
              if (!blockDataMap[blockNum]) {
                blockDataMap[blockNum] = {};
              }
              if (!blockDataMap[blockNum][skillName]) {
                blockDataMap[blockNum][skillName] = [];
              }
              const numericValue = levelToNumeric(termData[key]);
              if (numericValue !== null) {
                blockDataMap[blockNum][skillName].push(numericValue);
              }
            }
          }
        });
      });

      // Calculate averages and create chart data array
      const maxBlock = Math.max(...Object.keys(blockDataMap).map(Number), 0);
      const chartData = [];
      
      for (let blockNum = 1; blockNum <= maxBlock; blockNum++) {
        const blockEntry = { block: blockNum };
        allSkills.forEach(skill => {
          if (blockDataMap[blockNum] && blockDataMap[blockNum][skill]) {
            const values = blockDataMap[blockNum][skill];
            if (values.length > 0) {
              const avg = values.reduce((a, b) => a + b, 0) / values.length;
              blockEntry[skill] = Math.round(avg * 10) / 10;
            }
          }
        });
        chartData.push(blockEntry);
      }

      return { data: chartData, skills: Array.from(allSkills) };
    } else {
      // Current term only
      const skillDataMap = {};
      const maxBlock = activeTermConfig.blocks || 0;

      // Group data by block
      Object.keys(skillLevels).forEach(key => {
        if (key.startsWith(`${activeTerm}-`)) {
          const parts = key.split('-');
          const skillName = parts.slice(1, -1).join('-');
          const blockNum = parseInt(parts[parts.length - 1]);
          
          if (blockNum <= maxBlock) {
            if (!skillDataMap[blockNum]) {
              skillDataMap[blockNum] = {};
            }
            
            const level = skillLevels[key];
            const numericValue = levelToNumeric(level);
            if (numericValue !== null) {
              skillDataMap[blockNum][skillName] = numericValue;
            }
          }
        }
      });

      // Convert to array format
      const chartData = [];
      const allSkills = new Set();
      
      Object.entries(skillDataMap).forEach(([blockNum, skills]) => {
        Object.keys(skills).forEach(skill => allSkills.add(skill));
      });

      for (let blockNum = 1; blockNum <= maxBlock; blockNum++) {
        const blockEntry = { block: blockNum };
        if (skillDataMap[blockNum]) {
          Object.entries(skillDataMap[blockNum]).forEach(([skill, value]) => {
            blockEntry[skill] = value;
          });
        }
        chartData.push(blockEntry);
      }

      return { data: chartData, skills: Array.from(allSkills) };
    }
  }, [skillLevels, activeTerm, showAllTerms, allTermsData, termConfig, activeTermConfig]);

  // Load all terms data when toggle is switched to "all terms"
  useEffect(() => {
    if (showAllTerms && Object.keys(allTermsData).length === 0) {
      loadAllTermsData();
    }
  }, [showAllTerms]);

  // When available skills change, add new ones to chartVisibleSkills (default on)
  const chartSkillsKey = prepareChartData.skills ? prepareChartData.skills.slice().sort().join(',') : '';
  useEffect(() => {
    if (prepareChartData.skills && prepareChartData.skills.length > 0) {
      setChartVisibleSkills(prev => {
        const next = { ...prev };
        let changed = false;
        prepareChartData.skills.forEach(skill => {
          if (next[skill] === undefined) {
            next[skill] = true;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [chartSkillsKey]);

  const handleColorChange = (level, color) => {
    setColorScheme(prev => ({
      ...prev,
      [level]: color
    }));
    // Mark that colors were edited by the user
    setColorsEdited(true);
  };

  const resetToDefaults = () => {
    if (isLeader) {
      resetSkillChartData();
    } else {
      setColorScheme({
        unstarted: '#ffffff',
        urgent: '#ef4444',
        development: '#f97316',
        growth: '#eab308',
        aboveAverage: '#84cc16',
        excellent: '#22c55e'
      });
    }
  };

  const exportToPDF = () => {
    // Create a simple HTML structure for the PDF
    const memberName = memberHabit?.member?.username || 'Student';
    const term = activeTermConfig.name || activeTerm;
    
    let htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #1e40af; margin-bottom: 5px; }
            h2 { color: #3b82f6; margin-bottom: 10px; }
            .subtitle { color: #6b7280; font-size: 12px; margin-bottom: 20px; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background-color: #f3f4f6; font-weight: bold; }
            .category-header { background-color: #dbeafe; font-weight: bold; text-align: center; }
            .legend { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 20px; }
            .legend-item { display: flex; align-items: center; gap: 8px; }
            .color-box { width: 20px; height: 20px; border: 1px solid #9ca3af; }
            .footer { margin-top: 30px; font-size: 12px; color: #6b7280; text-align: center; }
          </style>
        </head>
        <body>
          <h1>Skill Development Chart</h1>
          <h2>IP Creative Learning Standards</h2>
          <div class="subtitle">Student: ${memberName} | Term: ${term} (${activeTermConfig.dates})</div>
          
          <div class="legend">
    `;

    // Add color legend
    levelOrder.forEach(level => {
      const color = colorScheme[level];
      const name = getLevelName(level);
      htmlContent += `
        <div class="legend-item">
          <div class="color-box" style="background-color: ${color}"></div>
          <span>${name}</span>
        </div>
      `;
    });

    htmlContent += `
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Skills</th>
    `;

    // Add week headers
    for (let i = 1; i <= (activeTermConfig.blocks || 0); i++) {
      htmlContent += `<th>Block ${i}</th>`;
    }

    htmlContent += `
              </tr>
            </thead>
            <tbody>
    `;

    // Add skill data
    skillCategories.forEach((category, categoryIndex) => {
      // Category header
      htmlContent += `
        <tr class="category-header">
          <td colspan="${(activeTermConfig.blocks || 0) + 1}">${category.name}</td>
        </tr>
      `;

      // Skills in this category
      category.skills.forEach((skill) => {
        htmlContent += '<tr>';
        htmlContent += `<td>${skill}</td>`;
        
        for (let blockIndex = 1; blockIndex <= (activeTermConfig.blocks || 0); blockIndex++) {
          const level = getSkillLevel(skill, blockIndex);
          const color = getColorForLevel(level);
          htmlContent += `<td style="background-color: ${color}; text-align: center;">${getLevelName(level).charAt(0)}</td>`;
        }
        
        htmlContent += '</tr>';
      });
    });

    htmlContent += `
            </tbody>
          </table>
          
          <div class="footer">
            Generated on ${new Date().toLocaleDateString()} - IP Creative Learning Standards
          </div>
        </body>
      </html>
    `;

    // Open in new window for printing
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-4 sm:p-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-secondary-900 dark:text-white mb-2">
          Skill Development Chart
        </h2>
        <div className="bg-blue-600 text-white px-4 py-2 rounded-lg inline-block">
          <span className="font-semibold">IP Creative Learning Standards</span>
        </div>
      </div>

      {/* Term Navigation */}
      <div className="mb-6">
        <div className="flex flex-wrap justify-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {Object.entries(termConfig).map(([key, config]) => (
            <button
              key={key}
              onClick={async () => {
                // Prevent rapid term switching - wait for pending operations to complete
                if (pendingOperationRef.current) {
                  console.log('Term switch blocked: pending operation in progress');
                  return;
                }
                
                // If in edit mode, save and exit edit mode before switching
                if (activeTerm !== key && (isEditingColors || isEditingSkills)) {
                  setLoading(true);
                  isSwitchingTermRef.current = true;
                  
                  // Save current term's data first (this ensures any unsaved edits are saved)
                  try {
                    await saveSkillChartData(activeTerm);
                    console.log('Saved current term data before switching (edit mode was on)');
                  } catch (err) {
                    console.error('Error saving before term switch:', err);
                  }
                  
                  // Turn off edit modes
                  setIsEditingColors(false);
                  setIsEditingSkills(false);
                  
                  // Small delay to ensure save completes before switching
                  await new Promise(resolve => setTimeout(resolve, 100));
                }
                
                // Set loading immediately to hide chart before state updates
                if (activeTerm !== key) {
                  setLoading(true);
                  // Set flag to prevent auto-save from running during term switch
                  isSwitchingTermRef.current = true;
                }
                // setActiveTerm will trigger the useEffect that handles saving/loading
                setActiveTerm(key);
              }}
              disabled={pendingOperationRef.current !== null}
              className={`px-3 py-2 rounded-md font-medium transition-colors text-xs sm:text-sm ${
                activeTerm === key
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : pendingOperationRef.current
                  ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
                      title={config.dates}
            >
              {config.name}
            </button>
          ))}
        </div>
        <div className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          {activeTermConfig.dates} • {activeTermConfig.blocks} weeks
        </div>
      </div>

      {/* Color Legend */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {levelOrder.map((level) => {
            const color = colorScheme[level];
            return (
            <div key={level} className="text-center">
              <div className="flex items-center justify-center mb-2">
                <div 
                  className="w-8 h-8 rounded border-2"
                  style={{ 
                    backgroundColor: color,
                    borderColor: level === 'unstarted' ? '#9ca3af' : (color === '#ffffff' || color === '#FFFFFF' ? '#9ca3af' : '#d1d5db')
                  }}
                ></div>
                {isEditingColors && (
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => handleColorChange(level, e.target.value)}
                    className="ml-2 w-8 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                    title={`Change color for ${getLevelName(level)}`}
                  />
                )}
              </div>
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {getLevelName(level)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {getLevelDescription(level)}
              </div>
            </div>
            );
          })}
        </div>
        {isEditingColors && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300 text-center font-medium">
              💡 Color editing mode: Click the color squares above to change the colors for each development level
            </p>
          </div>
        )}
      </div>


       {/* Saving Indicator (only show when saving, not loading) */}
       {saving && !loading && (
         <div className="mb-4 text-center">
           <div className="inline-flex items-center gap-2 text-green-600 dark:text-green-400">
             <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
             <span className="text-sm font-medium">Saving changes...</span>
           </div>
         </div>
       )}

      {/* Controls */}
      {(isLeader || isCoach) && (
        <div className="mb-6 flex justify-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setIsEditingColors(!isEditingColors);
              if (isEditingColors) {
                setIsEditingSkills(false); // Turn off skills editing when turning off colors
              }
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isEditingColors 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            }`}
          >
            {isEditingColors ? '✓ Done Editing Colors' : '🎨 Edit Colors'}
          </button>
          <button
            onClick={() => {
              setIsEditingSkills(!isEditingSkills);
              if (isEditingSkills) {
                setIsEditingColors(false); // Turn off colors editing when turning off skills
              }
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isEditingSkills 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
            }`}
          >
            {isEditingSkills ? '✓ Done Editing Skills' : '📊 Edit Skills'}
          </button>
          {(isEditingColors || isEditingSkills) && (
            <button
              onClick={() => {
                resetToDefaults();
                setSkillLevels({});
                setIsEditingColors(false);
                setIsEditingSkills(false);
              }}
              className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              🔄 Reset All
            </button>
          )}
          {!(isEditingColors || isEditingSkills) && (
            <button
              onClick={exportToPDF}
              className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors font-medium"
            >
              📄 Export as PDF
            </button>
          )}
        </div>
      )}

      {/* Skills Chart */}
      {isEditingSkills && !loading && (
        <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
          <p className="text-sm text-purple-700 dark:text-purple-300 text-center font-medium">
            💡 Skills editing mode ({activeTermConfig.name}): Click on any cell in the chart below to cycle through development levels
          </p>
        </div>
      )}
      {loading ? (
        /* Loading State - Show spinner instead of chart */
        <div className="flex items-center justify-center py-16 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Loading skill chart data...
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Please wait while we load the data for {activeTermConfig.name}
            </p>
          </div>
        </div>
      ) : (
        /* Chart Table - Only show when data is loaded */
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
          {/* Header Row */}
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <th className="border border-gray-300 dark:border-gray-600 p-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                Skills
              </th>
              {Array.from({ length: activeTermConfig.blocks || 0 }, (_, i) => (
                <th key={i} className="border border-gray-300 dark:border-gray-600 p-3 text-center font-semibold text-gray-700 dark:text-gray-300">
                  BLOCK {i + 1}
                </th>
              ))}
            </tr>
          </thead>

          {/* Skills Rows */}
          <tbody>
            {skillCategories.map((category, categoryIndex) => (
              <React.Fragment key={categoryIndex}>
                {/* Category Header */}
                <tr className="bg-blue-50 dark:bg-blue-900/20">
                  <td 
                    colSpan={(activeTermConfig.blocks || 0) + 1} 
                    className="border border-gray-300 dark:border-gray-600 p-3 font-bold text-blue-800 dark:text-blue-300 text-center"
                  >
                    {category.name}
                  </td>
                </tr>
                
                {/* Skills in this category */}
                {category.skills.map((skill, skillIndex) => (
                  <tr key={skillIndex} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="border border-gray-300 dark:border-gray-600 p-3 font-medium text-gray-700 dark:text-gray-300">
                      {skill}
                    </td>
                    {Array.from({ length: activeTermConfig.blocks || 0 }, (_, blockIndex) => {
                      const level = getSkillLevel(skill, blockIndex + 1);
                      const color = getColorForLevel(level);
                      const cellKey = `${activeTerm}-${skill}-${blockIndex + 1}`;
                      const cellEditHistory = editHistory[cellKey];
                      const isHovered = hoveredCell === cellKey;
                      
                      return (
                        <td 
                          key={blockIndex} 
                          className={`border border-gray-300 dark:border-gray-600 p-2 text-center relative ${
                            isEditingSkills && (isLeader || isCoach) ? 'cursor-pointer hover:opacity-80' : ''
                          }`}
                          style={{ backgroundColor: color }}
                          onMouseEnter={(e) => {
                            if (cellEditHistory) {
                              setHoveredCell(cellKey);
                              const rect = e.currentTarget.getBoundingClientRect();
                              setTooltipPosition({
                                x: rect.left + rect.width / 2,
                                y: rect.top - 10
                              });
                            }
                          }}
                          onMouseLeave={() => {
                            setHoveredCell(null);
                          }}
                          onMouseMove={(e) => {
                            if (cellEditHistory && hoveredCell === cellKey) {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setTooltipPosition({
                                x: rect.left + rect.width / 2,
                                y: rect.top - 10
                              });
                            }
                          }}
                          onClick={() => {
                            if (isEditingSkills && (isLeader || isCoach)) {
                              const nextLevel = getNextLevel(level);
                              updateSkillLevel(skill, blockIndex + 1, nextLevel);
                            }
                          }}
                        >
                          {(isLeader || isCoach) && (
                            <div className="w-8 h-8 mx-auto rounded border border-gray-400 dark:border-gray-500"></div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {/* Line Chart Visualization */}
      {!loading && (
        <div className="mt-8 bg-white dark:bg-secondary-800 rounded-lg shadow-card p-4 sm:p-6">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
            <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">
              Skill Development Trend
            </h3>
            <div className="flex flex-wrap gap-2 items-center">
              <button
                onClick={() => setShowAllTerms(!showAllTerms)}
                className="px-4 py-2 rounded-lg font-medium transition-colors bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50"
              >
                {showAllTerms ? '📊 Show Current Term' : '📈 Show All Terms'}
              </button>
              {prepareChartData.skills?.length > 0 && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Toggle skills below to show/hide lines
                </span>
              )}
            </div>
          </div>

          {/* Skill toggles - show/hide lines */}
          {prepareChartData.skills && prepareChartData.skills.length > 0 && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-secondary-700/50 rounded-lg border border-gray-200 dark:border-secondary-600">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Show on graph:</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {prepareChartData.skills.map((skill, index) => (
                  <label key={skill} className="inline-flex items-center gap-1.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={chartVisibleSkills[skill] !== false}
                      onChange={() => {
                        setChartVisibleSkills(prev => ({ ...prev, [skill]: prev[skill] === false }));
                      }}
                      className="rounded border-gray-400 text-blue-600 focus:ring-blue-500"
                    />
                    <span
                      className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white"
                      style={{ borderBottomWidth: 2, borderBottomColor: CHART_LINE_COLORS[index % CHART_LINE_COLORS.length] }}
                    >
                      {skill}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    const on = {};
                    prepareChartData.skills.forEach(s => { on[s] = true; });
                    setChartVisibleSkills(on);
                  }}
                  className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-secondary-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-secondary-500"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const off = {};
                    prepareChartData.skills.forEach(s => { off[s] = false; });
                    setChartVisibleSkills(off);
                  }}
                  className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-secondary-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-secondary-500"
                >
                  Deselect all
                </button>
              </div>
            </div>
          )}
          
          {prepareChartData.data && prepareChartData.data.length > 0 && prepareChartData.skills.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={prepareChartData.data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="block" 
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    label={{ value: 'Block', position: 'insideBottom', offset: -5 }}
                    tick={{ fill: '#6b7280' }}
                  />
                  <YAxis 
                    domain={[0, 4]}
                    label={{ value: 'Development Level', angle: -90, position: 'insideLeft' }}
                    tick={{ fill: '#6b7280' }}
                    tickFormatter={(value) => {
                      const levelMap = ['Urgent', 'Development', 'Growth', 'Above Avg', 'Excellent'];
                      return levelMap[value] || '';
                    }}
                  />
                  <Tooltip 
                    formatter={(value, name) => {
                      const levelMap = ['Urgent', 'Development', 'Growth', 'Above Average', 'Excellent'];
                      return [levelMap[Math.round(value)] || value, name];
                    }}
                    labelFormatter={(label) => `Block ${label}`}
                  />
                  <Legend />
                  {prepareChartData.skills
                    .filter(skill => chartVisibleSkills[skill] !== false)
                    .map(skill => (
                      <Line
                        key={skill}
                        type="monotone"
                        dataKey={skill}
                        name={skill}
                        stroke={CHART_LINE_COLORS[prepareChartData.skills.indexOf(skill) % CHART_LINE_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        connectNulls={false}
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {showAllTerms 
                ? 'No data available across all terms' 
                : `No skill data available for ${activeTermConfig.name}`}
            </div>
          )}
        </div>
      )}

      {/* Custom Hover Tooltip */}
      {hoveredCell && editHistory[hoveredCell] && (
        <div
          className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transition: 'opacity 0.2s ease-in-out'
          }}
        >
          <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg px-3 py-2 max-w-xs">
            <div className="font-semibold mb-1">
              Last edited by {editHistory[hoveredCell].editorName}
            </div>
            <div className="text-gray-300">
              {formatRelativeTime(new Date(editHistory[hoveredCell].editedAt))}
            </div>
            {/* Tooltip arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
              <div className="w-2 h-2 bg-gray-900 dark:bg-gray-700 transform rotate-45"></div>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
          How to Use This Chart ({activeTermConfig.name}):
        </h4>
        <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
          <li>• Each skill is evaluated across {activeTermConfig.blocks} blocks</li>
          <li>• White blocks indicate unstarted/not evaluated</li>
          <li>• Colors indicate development level from urgent (red) to excellent (green)</li>
          <li>• Group leaders can customize colors by clicking "Edit Colors"</li>
          <li>• Group leaders can update skill levels by clicking "Edit Skills" and clicking on cells</li>
          <li>• Click cells to cycle through development levels when in edit mode</li>
          <li>• Hover over cells to see detailed information</li>
          <li>• Switch between terms using the tabs above</li>
        </ul>
      </div>

      {/* Last Edited By Footer */}
      {lastEditedBy && lastEditedAt && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 text-center text-sm text-gray-600 dark:text-gray-400">
          Last edited by <span className="font-semibold text-gray-700 dark:text-gray-300">{lastEditedBy.username}</span>{' '}
          {formatRelativeTime(new Date(lastEditedAt))}
        </div>
      )}
    </div>
  );
};

// Helper function to format relative time
const formatRelativeTime = (date) => {
  if (!date) return '';
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} weeks ago`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
  return `${Math.floor(diffInSeconds / 31536000)} years ago`;
};

export default ColorChart;
