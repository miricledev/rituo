"""
Recovery script to check for lost skill chart data.

This script helps identify:
1. Skill charts that might have been overwritten
2. Recent updates to skill charts (within last 7 days)
3. Potential data recovery options

Run this script to see what data exists in the database.
"""
import os
import sys
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the server directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db.database import db
from db.models import SkillDevelopmentChart, Group, User
from server import app

def recover_skill_chart_data():
    """Check for skill chart data and potential recovery options"""
    with app.app_context():
        print("=" * 80)
        print("SKILL CHART DATA RECOVERY REPORT")
        print("=" * 80)
        print()
        
        # Get all skill charts
        all_charts = SkillDevelopmentChart.query.all()
        
        print(f"Total skill charts in database: {len(all_charts)}")
        print()
        
        # Group by group_id, member_id, term
        charts_by_key = {}
        for chart in all_charts:
            key = (chart.group_id, chart.member_id, chart.term)
            if key not in charts_by_key:
                charts_by_key[key] = []
            charts_by_key[key].append(chart)
        
        # Find charts updated in the last 7 days
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        recent_charts = SkillDevelopmentChart.query.filter(
            SkillDevelopmentChart.updated_at >= seven_days_ago
        ).order_by(SkillDevelopmentChart.updated_at.desc()).all()
        
        print("=" * 80)
        print("RECENT UPDATES (Last 7 Days)")
        print("=" * 80)
        print()
        
        if recent_charts:
            for chart in recent_charts:
                group = Group.query.get(chart.group_id)
                member = User.query.get(chart.member_id)
                
                # Count non-empty skill levels
                skill_levels = chart.skill_levels or {}
                non_empty_levels = sum(1 for v in skill_levels.values() if v and v != 'unstarted')
                
                print(f"Chart ID: {chart.id}")
                print(f"  Group: {group.name if group else 'Unknown'} (ID: {chart.group_id})")
                print(f"  Member: {member.username if member else 'Unknown'} (ID: {chart.member_id})")
                print(f"  Term: {chart.term}")
                print(f"  Updated: {chart.updated_at}")
                print(f"  Skill Levels: {len(skill_levels)} total, {non_empty_levels} non-empty")
                print(f"  Has Color Scheme: {bool(chart.color_scheme)}")
                
                # Show sample of skill levels (first 5)
                if skill_levels:
                    sample_keys = list(skill_levels.keys())[:5]
                    print(f"  Sample Keys: {sample_keys}")
                else:
                    print(f"  ⚠️  WARNING: Empty skill_levels!")
                
                print()
        else:
            print("No charts updated in the last 7 days.")
            print()
        
        # Check for potentially corrupted data (empty skill_levels but recent update)
        print("=" * 80)
        print("POTENTIALLY LOST DATA (Empty skill_levels with recent updates)")
        print("=" * 80)
        print()
        
        potentially_lost = []
        for chart in recent_charts:
            skill_levels = chart.skill_levels or {}
            if not skill_levels or len(skill_levels) == 0:
                potentially_lost.append(chart)
        
        if potentially_lost:
            print(f"Found {len(potentially_lost)} charts with empty skill_levels:")
            print()
            for chart in potentially_lost:
                group = Group.query.get(chart.group_id)
                member = User.query.get(chart.member_id)
                print(f"  - Chart ID {chart.id}: {group.name if group else 'Unknown'} / {member.username if member else 'Unknown'} / {chart.term}")
                print(f"    Updated: {chart.updated_at}")
                print(f"    Created: {chart.created_at}")
                print()
        else:
            print("No empty skill charts found in recent updates.")
            print()
        
        # Check database for any backup/recovery options
        print("=" * 80)
        print("DATABASE RECOVERY OPTIONS")
        print("=" * 80)
        print()
        print("If data was lost, check:")
        print("1. Database backups (if configured)")
        print("2. Application logs for error messages around the time of loss")
        print("3. PostgreSQL WAL (Write-Ahead Log) if point-in-time recovery is enabled")
        print()
        
        # Show all unique group/member/term combinations
        print("=" * 80)
        print("ALL UNIQUE CHART COMBINATIONS")
        print("=" * 80)
        print()
        
        unique_combos = {}
        for chart in all_charts:
            group = Group.query.get(chart.group_id)
            member = User.query.get(chart.member_id)
            combo_key = (
                group.name if group else f"Group_{chart.group_id}",
                member.username if member else f"User_{chart.member_id}",
                chart.term
            )
            if combo_key not in unique_combos:
                unique_combos[combo_key] = []
            unique_combos[combo_key].append(chart)
        
        for (group_name, member_name, term), charts in sorted(unique_combos.items()):
            print(f"{group_name} / {member_name} / {term}: {len(charts)} chart(s)")
            for chart in charts:
                skill_levels = chart.skill_levels or {}
                non_empty = sum(1 for v in skill_levels.values() if v and v != 'unstarted')
                print(f"  - Chart ID {chart.id}: {len(skill_levels)} levels, {non_empty} non-empty, updated {chart.updated_at}")
        
        print()
        print("=" * 80)
        print("RECOVERY COMPLETE")
        print("=" * 80)

if __name__ == '__main__':
    recover_skill_chart_data()

