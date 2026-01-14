from server import app, db
from server.db.models import SkillDevelopmentChart, Group
from datetime import datetime

with app.app_context():
    group_id_str = 'c852b22c'
    member_id = 14
    term = 'autumn1'
    
    group = Group.query.filter_by(group_id=group_id_str).first()
    if not group:
        print('Group not found')
        exit(1)
    
    skill_levels = {
        'autumn1-Attitude-1': 'development', 'autumn1-Attitude-2': 'development', 
        'autumn1-Attitude-3': 'development', 'autumn1-Attitude-4': 'development', 
        'autumn1-Attitude-5': 'growth', 'autumn1-Attitude-6': 'growth', 
        'autumn1-Attitude-7': 'aboveAverage', 'autumn1-Attitude-8': 'growth',
        'autumn1-Awareness-1': 'development', 'autumn1-Awareness-2': 'development', 
        'autumn1-Awareness-3': 'development', 'autumn1-Awareness-4': 'development', 
        'autumn1-Awareness-5': 'development', 'autumn1-Awareness-6': 'development', 
        'autumn1-Awareness-7': 'development', 'autumn1-Awareness-8': 'development',
        'autumn1-Coachability-1': 'urgent', 'autumn1-Coachability-2': 'urgent', 
        'autumn1-Coachability-3': 'urgent', 'autumn1-Coachability-4': 'development', 
        'autumn1-Coachability-5': 'growth', 'autumn1-Coachability-6': 'growth', 
        'autumn1-Coachability-7': 'aboveAverage', 'autumn1-Coachability-8': 'growth',
        'autumn1-Comfort Zone-1': 'urgent', 'autumn1-Comfort Zone-2': 'urgent', 
        'autumn1-Comfort Zone-3': 'urgent', 'autumn1-Comfort Zone-4': 'urgent', 
        'autumn1-Comfort Zone-5': 'development', 'autumn1-Comfort Zone-6': 'growth', 
        'autumn1-Comfort Zone-7': 'growth', 'autumn1-Comfort Zone-8': 'growth',
        'autumn1-Communication skills-1': 'urgent', 'autumn1-Communication skills-2': 'urgent', 
        'autumn1-Communication skills-3': 'urgent', 'autumn1-Communication skills-4': 'urgent', 
        'autumn1-Communication skills-5': 'development', 'autumn1-Communication skills-6': 'growth', 
        'autumn1-Communication skills-7': 'growth', 'autumn1-Communication skills-8': 'growth',
        'autumn1-Concentration-1': 'development', 'autumn1-Concentration-2': 'development', 
        'autumn1-Concentration-3': 'development', 'autumn1-Concentration-4': 'development', 
        'autumn1-Concentration-5': 'development', 'autumn1-Concentration-6': 'development', 
        'autumn1-Concentration-7': 'growth', 'autumn1-Concentration-8': 'growth',
        'autumn1-Desire-1': 'urgent', 'autumn1-Desire-2': 'urgent', 
        'autumn1-Desire-3': 'urgent', 'autumn1-Desire-4': 'urgent', 
        'autumn1-Desire-5': 'development', 'autumn1-Desire-6': 'development', 
        'autumn1-Desire-7': 'growth', 'autumn1-Desire-8': 'development',
        'autumn1-Discipline-1': 'development', 'autumn1-Discipline-2': 'development', 
        'autumn1-Discipline-3': 'development', 'autumn1-Discipline-4': 'development', 
        'autumn1-Discipline-5': 'development', 'autumn1-Discipline-6': 'development', 
        'autumn1-Discipline-7': 'aboveAverage', 'autumn1-Discipline-8': 'growth',
        'autumn1-Emotional Control-1': 'development', 'autumn1-Emotional Control-2': 'development', 
        'autumn1-Emotional Control-3': 'development', 'autumn1-Emotional Control-4': 'development', 
        'autumn1-Emotional Control-5': 'development', 'autumn1-Emotional Control-6': 'growth', 
        'autumn1-Emotional Control-7': 'growth', 'autumn1-Emotional Control-8': 'growth',
        'autumn1-Energy-1': 'development', 'autumn1-Energy-2': 'development', 
        'autumn1-Energy-3': 'development', 'autumn1-Energy-4': 'development', 
        'autumn1-Energy-5': 'growth', 'autumn1-Energy-6': 'growth', 
        'autumn1-Energy-7': 'aboveAverage', 'autumn1-Energy-8': 'growth',
        'autumn1-Friendship Building-1': 'aboveAverage', 'autumn1-Friendship Building-2': 'aboveAverage', 
        'autumn1-Friendship Building-3': 'aboveAverage', 'autumn1-Friendship Building-4': 'aboveAverage', 
        'autumn1-Friendship Building-5': 'aboveAverage', 'autumn1-Friendship Building-6': 'aboveAverage', 
        'autumn1-Friendship Building-7': 'aboveAverage', 'autumn1-Friendship Building-8': 'growth',
        'autumn1-Imagination/Creativity-1': 'urgent', 'autumn1-Imagination/Creativity-2': 'urgent', 
        'autumn1-Imagination/Creativity-3': 'urgent', 'autumn1-Imagination/Creativity-4': 'urgent', 
        'autumn1-Imagination/Creativity-5': 'development', 'autumn1-Imagination/Creativity-6': 'growth', 
        'autumn1-Imagination/Creativity-7': 'growth', 'autumn1-Imagination/Creativity-8': 'growth',
        'autumn1-Leadership-1': 'urgent', 'autumn1-Leadership-2': 'urgent', 
        'autumn1-Leadership-3': 'urgent', 'autumn1-Leadership-4': 'urgent', 
        'autumn1-Leadership-5': 'development', 'autumn1-Leadership-6': 'development', 
        'autumn1-Leadership-7': 'growth', 'autumn1-Leadership-8': 'growth',
        'autumn1-Listening Skills-1': 'development', 'autumn1-Listening Skills-2': 'development', 
        'autumn1-Listening Skills-3': 'development', 'autumn1-Listening Skills-4': 'development', 
        'autumn1-Listening Skills-5': 'growth', 'autumn1-Listening Skills-6': 'growth', 
        'autumn1-Listening Skills-7': 'aboveAverage', 'autumn1-Listening Skills-8': 'growth',
        'autumn1-Maturity-1': 'development', 'autumn1-Maturity-2': 'development', 
        'autumn1-Maturity-3': 'development', 'autumn1-Maturity-4': 'development', 
        'autumn1-Maturity-5': 'development', 'autumn1-Maturity-6': 'development', 
        'autumn1-Maturity-7': 'growth', 'autumn1-Maturity-8': 'growth',
        'autumn1-Mental Toughness-1': 'development', 'autumn1-Mental Toughness-2': 'development', 
        'autumn1-Mental Toughness-3': 'development', 'autumn1-Mental Toughness-4': 'development', 
        'autumn1-Mental Toughness-5': 'development', 'autumn1-Mental Toughness-6': 'development', 
        'autumn1-Mental Toughness-7': 'growth', 'autumn1-Mental Toughness-8': 'growth',
        'autumn1-Patience-1': 'growth', 'autumn1-Patience-2': 'growth', 
        'autumn1-Patience-3': 'growth', 'autumn1-Patience-4': 'growth', 
        'autumn1-Patience-5': 'growth', 'autumn1-Patience-6': 'growth', 
        'autumn1-Patience-7': 'aboveAverage', 'autumn1-Patience-8': 'growth',
        'autumn1-Performance-1': 'urgent', 'autumn1-Performance-2': 'urgent', 
        'autumn1-Performance-3': 'urgent', 'autumn1-Performance-4': 'urgent', 
        'autumn1-Performance-5': 'growth', 'autumn1-Performance-6': 'growth', 
        'autumn1-Performance-7': 'aboveAverage', 'autumn1-Performance-8': 'aboveAverage',
        'autumn1-Physical health-1': 'development', 'autumn1-Physical health-2': 'development', 
        'autumn1-Physical health-3': 'development', 'autumn1-Physical health-4': 'development', 
        'autumn1-Physical health-5': 'development', 'autumn1-Physical health-6': 'development', 
        'autumn1-Physical health-7': 'growth', 'autumn1-Physical health-8': 'growth',
        'autumn1-Positive Reaction-1': 'development', 'autumn1-Positive Reaction-2': 'development', 
        'autumn1-Positive Reaction-3': 'development', 'autumn1-Positive Reaction-4': 'development', 
        'autumn1-Positive Reaction-5': 'growth', 'autumn1-Positive Reaction-6': 'growth', 
        'autumn1-Positive Reaction-7': 'growth', 'autumn1-Positive Reaction-8': 'aboveAverage',
        'autumn1-Problem solving-1': 'development', 'autumn1-Problem solving-2': 'development', 
        'autumn1-Problem solving-3': 'development', 'autumn1-Problem solving-4': 'development', 
        'autumn1-Problem solving-5': 'growth', 'autumn1-Problem solving-6': 'growth', 
        'autumn1-Problem solving-7': 'growth', 'autumn1-Problem solving-8': 'growth',
        'autumn1-Resilience-1': 'development', 'autumn1-Resilience-2': 'development', 
        'autumn1-Resilience-3': 'development', 'autumn1-Resilience-4': 'development', 
        'autumn1-Resilience-5': 'growth', 'autumn1-Resilience-6': 'growth', 
        'autumn1-Resilience-7': 'aboveAverage', 'autumn1-Resilience-8': 'growth',
        'autumn1-Respect-1': 'aboveAverage', 'autumn1-Respect-2': 'aboveAverage', 
        'autumn1-Respect-3': 'aboveAverage', 'autumn1-Respect-4': 'aboveAverage', 
        'autumn1-Respect-5': 'aboveAverage', 'autumn1-Respect-6': 'aboveAverage', 
        'autumn1-Respect-7': 'aboveAverage', 'autumn1-Respect-8': 'growth',
        'autumn1-Self Confidence-1': 'urgent', 'autumn1-Self Confidence-2': 'urgent', 
        'autumn1-Self Confidence-3': 'urgent', 'autumn1-Self Confidence-4': 'urgent', 
        'autumn1-Self Confidence-5': 'development', 'autumn1-Self Confidence-6': 'development', 
        'autumn1-Self Confidence-7': 'growth', 'autumn1-Self Confidence-8': 'growth',
        'autumn1-Team Work-1': 'development', 'autumn1-Team Work-2': 'development', 
        'autumn1-Team Work-3': 'development', 'autumn1-Team Work-4': 'development', 
        'autumn1-Team Work-5': 'development', 'autumn1-Team Work-6': 'development', 
        'autumn1-Team Work-7': 'growth', 'autumn1-Team Work-8': 'growth',
        'autumn1-Trust-1': 'development', 'autumn1-Trust-2': 'development', 
        'autumn1-Trust-3': 'development', 'autumn1-Trust-4': 'development', 
        'autumn1-Trust-5': 'growth', 'autumn1-Trust-6': 'growth', 
        'autumn1-Trust-7': 'aboveAverage', 'autumn1-Trust-8': 'aboveAverage'
    }
    color_scheme = {
        'unstarted': '#ffffff', 
        'urgent': '#ef4444', 
        'development': '#f97316', 
        'growth': '#eab308', 
        'aboveAverage': '#22c55e', 
        'excellent': '#15803d'
    }
    
    skill_chart = SkillDevelopmentChart.query.filter_by(
        group_id=group.id, 
        member_id=member_id, 
        term=term
    ).first()
    
    if skill_chart:
        skill_chart.skill_levels = skill_levels
        skill_chart.color_scheme = color_scheme
        skill_chart.updated_at = datetime.utcnow()
        print(f'Updated existing skill chart for member {member_id}, term {term}')
    else:
        skill_chart = SkillDevelopmentChart(
            group_id=group.id, 
            member_id=member_id, 
            term=term, 
            skill_levels=skill_levels, 
            color_scheme=color_scheme
        )
        db.session.add(skill_chart)
        print(f'Created new skill chart for member {member_id}, term {term}')
    
    db.session.commit()
    print('Successfully restored data!')
