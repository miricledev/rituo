-- Database schema for Rituo Application

-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    current_cycle_start_date DATE,
    current_cycle_end_date DATE
);

-- Tasks Table
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    cycle_start_date DATE NOT NULL,
    cycle_end_date DATE NOT NULL
);

-- Task Completion Table
CREATE TABLE task_completion (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    completion_date DATE NOT NULL,
    is_complete BOOLEAN DEFAULT FALSE,
    UNIQUE(task_id, completion_date)
);

-- Optional: Task Notes Table
CREATE TABLE task_notes (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_task_completion_task_id ON task_completion(task_id);
CREATE INDEX idx_task_completion_user_id ON task_completion(user_id);
CREATE INDEX idx_task_completion_date ON task_completion(completion_date);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_cycle_dates ON tasks(cycle_start_date, cycle_end_date);