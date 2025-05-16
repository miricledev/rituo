import React, { useState, useEffect } from 'react';
import { useTask } from '../contexts/TaskContext';

const HeatmapChart = () => {
  const { heatmapData, fetchHeatmapData, loading } = useTask();
  const [hoveredCell, setHoveredCell] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!heatmapData || heatmapData.length === 0) {
      fetchHeatmapData();
    }
  }, [heatmapData, fetchHeatmapData]);

  const handleCellHover = (data, e) => {
    setHoveredCell(data);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleCellLeave = () => {
    setHoveredCell(null);
  };

  // Get color based on completion rate
  const getColorClass = (rate) => {
    if (rate === 0) return 'bg-gray-100';
    if (rate < 25) return 'bg-blue-100';
    if (rate < 50) return 'bg-blue-200';
    if (rate < 75) return 'bg-blue-300';
    if (rate < 100) return 'bg-blue-400';
    return 'bg-blue-500';
  };

  if (loading || !heatmapData || heatmapData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-card p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/2 mb-6"></div>
        <div className="flex flex-wrap gap-1">
          {Array(14).fill(0).map((_, i) => (
            <div key={i} className="w-8 h-8 bg-gray-200 rounded-sm"></div>
          ))}
        </div>
      </div>
    );
  }

  // Group data by week for better visualization
  const groupedByWeek = [];
  let currentWeek = [];
  
  // Sort by date first
  const sortedData = [...heatmapData].sort((a, b) => 
    new Date(a.date) - new Date(b.date)
  );

  sortedData.forEach((day, index) => {
    const date = new Date(day.date);
    const dayOfWeek = date.getDay(); // 0 is Sunday, 1 is Monday, etc.
    
    // If this is the first day of a new week (Sunday) and currentWeek is not empty, push it to groupedByWeek
    if (dayOfWeek === 0 && currentWeek.length > 0) {
      groupedByWeek.push([...currentWeek]);
      currentWeek = [];
    }
    
    // Add the current day to the current week
    currentWeek.push(day);
    
    // If this is the last day, push the remaining week
    if (index === sortedData.length - 1) {
      groupedByWeek.push([...currentWeek]);
    }
  });

  return (
    <div className="bg-white rounded-lg shadow-card p-6">
      <h3 className="text-lg font-semibold mb-4">Completion Heatmap</h3>
      
      <div className="relative">
        {/* Header - Days of the week */}
        <div className="flex mb-2">
          <div className="w-8 mr-2"></div> {/* Empty space for alignment */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
            <div key={i} className="w-8 text-xs text-center text-secondary-600">
              {day}
            </div>
          ))}
        </div>
        
        {/* Heatmap grid */}
        <div className="space-y-2">
          {groupedByWeek.map((week, weekIndex) => (
            <div key={weekIndex} className="flex">
              {/* Week label */}
              <div className="w-8 mr-2 flex items-center justify-end">
                <span className="text-xs text-secondary-600">
                  {new Date(week[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
              
              {/* Days of the week */}
              <div className="flex">
                {/* Add empty cells for proper alignment */}
                {weekIndex === 0 && new Date(week[0].date).getDay() > 0 && (
                  Array(new Date(week[0].date).getDay()).fill(0).map((_, i) => (
                    <div key={`empty-${i}`} className="w-8 h-8 m-0.5"></div>
                  ))
                )}
                
                {/* Actual day cells */}
                {week.map((day) => (
                  <div
                    key={day.date}
                    className={`heatmap-cell ${getColorClass(day.completion_rate)}`}
                    onMouseEnter={(e) => handleCellHover(day, e)}
                    onMouseLeave={handleCellLeave}
                  ></div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        {/* Tooltip */}
        {hoveredCell && (
          <div 
            className="heatmap-tooltip"
            style={{ 
              left: `${tooltipPos.x}px`, 
              top: `${tooltipPos.y - 10}px`, 
              transform: 'translate(-50%, -100%)' 
            }}
          >
            <div>{new Date(hoveredCell.date).toLocaleDateString()}</div>
            <div>{hoveredCell.completed_tasks} of {hoveredCell.total_tasks} tasks completed ({Math.round(hoveredCell.completion_rate)}%)</div>
          </div>
        )}
      </div>
      
      {/* Legend */}
      <div className="mt-6 flex items-center justify-center">
        <div className="flex space-x-2 text-xs text-secondary-600">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-gray-100 rounded-sm mr-1"></div>
            <span>0%</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-100 rounded-sm mr-1"></div>
            <span>1-24%</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-200 rounded-sm mr-1"></div>
            <span>25-49%</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-300 rounded-sm mr-1"></div>
            <span>50-74%</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-400 rounded-sm mr-1"></div>
            <span>75-99%</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-500 rounded-sm mr-1"></div>
            <span>100%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeatmapChart;