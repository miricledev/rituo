import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

const ColorChart = ({ memberHabit, isLeader, groupId: propGroupId, groupType: propGroupType }) => {
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
  const hasFetchedGroupTypeRef = useRef(!!propGroupType);
  const previousGroupTypeRef = useRef(resolvedGroupType);
  const previousTermRef = useRef(null); // Track previous term to save before switching
  const isSwitchingTermRef = useRef(false); // Flag to prevent auto-save during term switch
  const pendingOperationRef = useRef(null); // Track pending save/load operations to prevent rapid switches

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
      }
    } catch (error) {
      console.error('Error loading skill chart data:', error);
      // Keep default values if loading fails
    } finally {
      setLoading(false);
    }
  };

  const saveSkillChartData = async (term = activeTerm) => {
    if (!memberId || !isLeader) {
      console.log('Save skipped:', { groupId, memberId, isLeader });
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
    
    console.log('Saving skill chart data:', { 
      groupId: targetGroupId, 
      memberId, 
      term, 
      totalSkillLevels: Object.keys(skillLevels).length,
      termSpecificSkillLevels: Object.keys(termSpecificSkillLevels).length,
      colorScheme 
    });
    setSaving(true);
    try {
      const response = await api.put(`/groups/${targetGroupId}/members/${memberId}/skill-charts/${term}`, {
        skillLevels: termSpecificSkillLevels, // Only save data for this specific term
        colorScheme: colorScheme
      });
      console.log('Save successful:', response.data);
    } catch (error) {
      console.error('Error saving skill chart data:', error);
      console.error('Error details:', error.response?.data);
    } finally {
      setSaving(false);
    }
  };

  const resetSkillChartData = async (term = activeTerm) => {
    if (!groupId || !memberId || !isLeader) return;
    
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
    
    // Don't clear skillLevels here - the loading state will hide the chart
    // Clearing would trigger auto-save and overwrite data
    
    // If we're switching terms, save the previous term's data first
    if (previousTermRef.current && previousTermRef.current !== activeTerm && isLeader) {
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
    if (!isLeader) {
      console.log('Auto-save skipped: not a leader');
      return;
    }
    
    // Don't auto-save if we're in the middle of switching terms
    if (isSwitchingTermRef.current) {
      console.log('Auto-save skipped: term switch in progress');
      return;
    }
    
    console.log('Auto-save effect triggered:', { skillLevels, colorScheme, activeTerm });
    const timeoutId = setTimeout(() => {
      // Double-check we're not switching terms (race condition protection)
      if (isSwitchingTermRef.current) {
        console.log('Auto-save cancelled: term switch detected during timeout');
        return;
      }
      
      console.log('Auto-save timeout triggered, calling saveSkillChartData');
      // saveSkillChartData filters by activeTerm, so this is safe
      saveSkillChartData();
    }, 1000); // Auto-save after 1 second of no changes

    return () => clearTimeout(timeoutId);
  }, [skillLevels, colorScheme]); // Removed activeTerm from dependencies - this prevents saving wrong term's data

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

  const handleColorChange = (level, color) => {
    setColorScheme(prev => ({
      ...prev,
      [level]: color
    }));
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
      {isLeader && (
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
                      
                      return (
                        <td 
                          key={blockIndex} 
                          className={`border border-gray-300 dark:border-gray-600 p-2 text-center ${
                            isEditingSkills && isLeader ? 'cursor-pointer hover:opacity-80' : ''
                          }`}
                          style={{ backgroundColor: color }}
                          title={`${skill} - Block ${blockIndex + 1}: ${getLevelName(level)}`}
                          onClick={() => {
                            if (isEditingSkills && isLeader) {
                              const nextLevel = getNextLevel(level);
                              updateSkillLevel(skill, blockIndex + 1, nextLevel);
                            }
                          }}
                        >
                          {isLeader && (
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
    </div>
  );
};

export default ColorChart;
