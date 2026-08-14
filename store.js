/* ============================================
   ARES OS — Central Store
   State management & localStorage persistence
   ============================================ */

(function (global) {
    'use strict';

    const STORAGE_KEY = 'ares_os_state_v1';
    const CURRENT_VERSION = 1;

    function createDefaultState() {
        return {
            version: CURRENT_VERSION,
            settings: {
                theme: 'dark',
                accentColor: 'purple',
                userName: 'Ares',
                weekStartsOn: 0,
                timeFormat: '12h',
                notifications: true
            },
            tasks: [],
            habits: [],
            goals: [],
            notes: [],
            dailyMissions: {},
            focusSessions: [],
            activity: [],
            metadata: {
                createdAt: Date.now(),
                lastUpdated: Date.now()
            }
        };
    }

    let state = null;
    let subscribers = [];

    /* ============ INITIALIZATION ============ */

    function init() {
        if (state) return state;

        const stored = AresUtils.storageGet(STORAGE_KEY, null);

        if (stored && typeof stored === 'object') {
            state = migrateState(stored);
        } else {
            state = createDefaultState();
            saveState();
        }

        return getStateCopy();
    }

    function migrateState(storedState) {
        if (!storedState.version) {
            storedState.version = 1;
        }

        const defaultState = createDefaultState();
        const migrated = deepMerge(defaultState, storedState);

        if (!migrated.metadata) {
            migrated.metadata = {
                createdAt: Date.now(),
                lastUpdated: Date.now()
            };
        }

        return migrated;
    }

    function deepMerge(target, source) {
        const result = { ...target };

        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (
                    source[key] &&
                    typeof source[key] === 'object' &&
                    !Array.isArray(source[key])
                ) {
                    result[key] = deepMerge(
                        target[key] || {},
                        source[key]
                    );
                } else {
                    result[key] = source[key];
                }
            }
        }

        return result;
    }

    /* ============ STATE MANAGEMENT ============ */

    function getStateCopy() {
        return AresUtils.deepClone(state);
    }

    function getState() {
        if (!state) init();
        return getStateCopy();
    }

    function saveState() {
        if (!state) return false;

        state.metadata.lastUpdated = Date.now();

        const success = AresUtils.storageSet(
            STORAGE_KEY,
            state
        );

        if (success) {
            notify({
                type: 'STATE_CHANGED',
                action: 'STATE_SAVED',
                payload: null,
                state: getStateCopy()
            });
        }

        return success;
    }

    function resetState() {
        state = createDefaultState();

        saveState();

        notify({
            type: 'STATE_RESET',
            action: 'STATE_RESET',
            payload: null,
            state: getStateCopy()
        });

        return getStateCopy();
    }

    /* ============ SUBSCRIPTION SYSTEM ============ */

    function subscribe(listener) {
        if (typeof listener !== 'function') {
            throw new Error('Subscriber must be a function');
        }

        subscribers.push(listener);

        return function unsubscribe() {
            const index = subscribers.indexOf(listener);

            if (index > -1) {
                subscribers.splice(index, 1);
            }
        };
    }

    function unsubscribe(listener) {
        const index = subscribers.indexOf(listener);

        if (index > -1) {
            subscribers.splice(index, 1);
        }
    }

    function notify(event) {
        subscribers.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.warn(
                    'Error in store subscriber:',
                    error
                );
            }
        });
    }

    function commit(action, payload) {
        if (!state) init();

        saveState();

        notify({
            type: 'STATE_CHANGED',
            action: action,
            payload: payload,
            state: getStateCopy()
        });
    }

    /* ============ GENERIC GET/SET ============ */

    function get(path, defaultValue) {
        if (!state) init();

        const keys = path.split('.');
        let value = state;

        for (const key of keys) {
            if (
                value &&
                typeof value === 'object' &&
                key in value
            ) {
                value = value[key];
            } else {
                return defaultValue;
            }
        }

        return AresUtils.deepClone(value);
    }

    function set(path, value) {
        if (!state) init();

        const keys = path.split('.');
        let target = state;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];

            if (
                !target[key] ||
                typeof target[key] !== 'object'
            ) {
                target[key] = {};
            }

            target = target[key];
        }

        target[keys[keys.length - 1]] = value;

        commit('SET', {
            path,
            value
        });
    }

    /* ============ TASK OPERATIONS ============ */

    function getTasks() {
        if (!state) init();

        return AresUtils.deepClone(state.tasks);
    }

    function getTask(id) {
        if (!state) init();

        const task = state.tasks.find(t => t.id === id);

        return task
            ? AresUtils.deepClone(task)
            : null;
    }

    function addTask(taskData) {
        if (!state) init();

        const task = {
            id: AresUtils.generateId(),
            title: taskData.title || 'Untitled Task',
            description: taskData.description || '',
            completed: false,
            priority: taskData.priority || 'medium',
            category: taskData.category || 'general',
            dueDate: taskData.dueDate || null,
            createdAt: Date.now(),
            completedAt: null,
            updatedAt: Date.now()
        };

        state.tasks.unshift(task);

        if (taskData.dueDate) {
            addActivity(
                'TASK_CREATED',
                task.title,
                task.id
            );
        }

        commit('TASK_ADDED', task);

        return AresUtils.deepClone(task);
    }

    function updateTask(id, updates) {
        if (!state) init();

        const index = state.tasks.findIndex(
            t => t.id === id
        );

        if (index === -1) return null;

        const allowedUpdates = [
            'title',
            'description',
            'priority',
            'category',
            'dueDate'
        ];

        allowedUpdates.forEach(key => {
            if (updates[key] !== undefined) {
                state.tasks[index][key] = updates[key];
            }
        });

        state.tasks[index].updatedAt = Date.now();

        commit('TASK_UPDATED', {
            id,
            updates
        });

        return AresUtils.deepClone(
            state.tasks[index]
        );
    }

    function deleteTask(id) {
        if (!state) init();

        const index = state.tasks.findIndex(
            t => t.id === id
        );

        if (index === -1) return false;

        const deleted = state.tasks[index];

        state.tasks.splice(index, 1);

        commit('TASK_DELETED', deleted);

        return true;
    }

    function toggleTask(id) {
        if (!state) init();

        const index = state.tasks.findIndex(
            t => t.id === id
        );

        if (index === -1) return null;

        const task = state.tasks[index];

        task.completed = !task.completed;

        task.completedAt = task.completed
            ? Date.now()
            : null;

        task.updatedAt = Date.now();

        addActivity(
            task.completed
                ? 'TASK_COMPLETED'
                : 'TASK_REOPENED',
            task.title,
            task.id
        );

        commit('TASK_TOGGLED', task);

        return AresUtils.deepClone(task);
    }

    function getCompletedTasks() {
        if (!state) init();

        return AresUtils.deepClone(
            state.tasks.filter(t => t.completed)
        );
    }

    function getPendingTasks() {
        if (!state) init();

        return AresUtils.deepClone(
            state.tasks.filter(t => !t.completed)
        );
    }

    /* ============ HABIT OPERATIONS ============ */

    function getHabits() {
        if (!state) init();

        return AresUtils.deepClone(state.habits);
    }

    function getHabit(id) {
        if (!state) init();

        const habit = state.habits.find(
            h => h.id === id
        );

        return habit
            ? AresUtils.deepClone(habit)
            : null;
    }

    function addHabit(habitData) {
        if (!state) init();

        const habit = {
            id: AresUtils.generateId(),
            title: habitData.title || 'New Habit',
            description: habitData.description || '',
            icon: habitData.icon || 'check',
            color: habitData.color || '#8b5cf6',
            frequency: habitData.frequency || 'daily',
            targetPerWeek: habitData.targetPerWeek || 7,
            completions: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        state.habits.unshift(habit);

        commit('HABIT_ADDED', habit);

        return AresUtils.deepClone(habit);
    }

    function updateHabit(id, updates) {
        if (!state) init();

        const index = state.habits.findIndex(
            h => h.id === id
        );

        if (index === -1) return null;

        const allowedUpdates = [
            'title',
            'description',
            'icon',
            'color',
            'frequency',
            'targetPerWeek'
        ];

        allowedUpdates.forEach(key => {
            if (updates[key] !== undefined) {
                state.habits[index][key] = updates[key];
            }
        });

        state.habits[index].updatedAt = Date.now();

        commit('HABIT_UPDATED', {
            id,
            updates
        });

        return AresUtils.deepClone(
            state.habits[index]
        );
    }

    function deleteHabit(id) {
        if (!state) init();

        const index = state.habits.findIndex(
            h => h.id === id
        );

        if (index === -1) return false;

        const deleted = state.habits[index];

        state.habits.splice(index, 1);

        commit('HABIT_DELETED', deleted);

        return true;
    }

    function toggleHabitToday(id) {
        if (!state) init();

        const index = state.habits.findIndex(
            h => h.id === id
        );

        if (index === -1) return null;

        const habit = state.habits[index];

        const todayKey = AresUtils.getTodayKey();

        const completionIndex =
            habit.completions.indexOf(todayKey);

        if (completionIndex > -1) {
            habit.completions.splice(
                completionIndex,
                1
            );
        } else {
            habit.completions.push(todayKey);
            habit.completions.sort();
        }

        habit.updatedAt = Date.now();

        commit('HABIT_TOGGLED', {
            habit: AresUtils.deepClone(habit),
            completed: completionIndex === -1
        });

        return AresUtils.deepClone(habit);
    }

    function isHabitCompletedToday(id) {
        if (!state) init();

        const habit = state.habits.find(
            h => h.id === id
        );

        if (!habit) return false;

        const todayKey = AresUtils.getTodayKey();

        return habit.completions.includes(todayKey);
    }

    function getHabitStreak(id) {
        if (!state) init();

        const habit = state.habits.find(
            h => h.id === id
        );

        if (!habit) return 0;

        return AresUtils.calculateStreak(
            habit.completions
        );
    }

    function getHabitCompletionRate(id) {
        if (!state) init();

        const habit = state.habits.find(
            h => h.id === id
        );

        if (!habit) return 0;

        const last7Days =
            AresUtils.getLastNDateKeys(7);

        const completionsInLast7Days =
            habit.completions.filter(date =>
                last7Days.includes(date)
            );

        return AresUtils.calculatePercentage(
            completionsInLast7Days.length,
            7
        );
    }

    /* ============ GOAL OPERATIONS ============ */

    function getGoals() {
        if (!state) init();

        return AresUtils.deepClone(state.goals);
    }

    function getGoal(id) {
        if (!state) init();

        const goal = state.goals.find(
            g => g.id === id
        );

        return goal
            ? AresUtils.deepClone(goal)
            : null;
    }

    function addGoal(goalData) {
        if (!state) init();

        const goal = {
            id: AresUtils.generateId(),
            title: goalData.title || 'New Goal',
            description: goalData.description || '',
            category: goalData.category || 'personal',
            progress: 0,
            target: goalData.target || 100,
            deadline: goalData.deadline || null,
            status: 'active',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        state.goals.unshift(goal);

        addActivity(
            'GOAL_CREATED',
            goal.title,
            goal.id
        );

        commit('GOAL_ADDED', goal);

        return AresUtils.deepClone(goal);
    }

    function updateGoal(id, updates) {
        if (!state) init();

        const index = state.goals.findIndex(
            g => g.id === id
        );

        if (index === -1) return null;

        const allowedUpdates = [
            'title',
            'description',
            'category',
            'deadline'
        ];

        allowedUpdates.forEach(key => {
            if (updates[key] !== undefined) {
                state.goals[index][key] = updates[key];
            }
        });

        state.goals[index].updatedAt = Date.now();

        commit('GOAL_UPDATED', {
            id,
            updates
        });

        return AresUtils.deepClone(
            state.goals[index]
        );
    }

    function deleteGoal(id) {
        if (!state) init();

        const index = state.goals.findIndex(
            g => g.id === id
        );

        if (index === -1) return false;

        const deleted = state.goals[index];

        state.goals.splice(index, 1);

        commit('GOAL_DELETED', deleted);

        return true;
    }

    function updateGoalProgress(id, progress) {
        if (!state) init();

        const index = state.goals.findIndex(
            g => g.id === id
        );

        if (index === -1) return null;

        const goal = state.goals[index];

        goal.progress = AresUtils.clamp(
            progress,
            0,
            goal.target
        );

        goal.updatedAt = Date.now();

        if (goal.progress >= goal.target) {
            goal.status = 'completed';

            addActivity(
                'GOAL_COMPLETED',
                goal.title,
                goal.id
            );
        } else {
            goal.status = 'active';
        }

        commit('GOAL_UPDATED', {
            id,
            progress
        });

        return AresUtils.deepClone(goal);
    }

    function completeGoal(id) {
        if (!state) init();

        const index = state.goals.findIndex(
            g => g.id === id
        );

        if (index === -1) return null;

        const goal = state.goals[index];

        goal.status = 'completed';
        goal.progress = goal.target;
        goal.updatedAt = Date.now();

        addActivity(
            'GOAL_COMPLETED',
            goal.title,
            goal.id
        );

        commit('GOAL_UPDATED', {
            id,
            status: 'completed'
        });

        return AresUtils.deepClone(goal);
    }

    /* ============ NOTE OPERATIONS ============ */

    function getNotes() {
        if (!state) init();

        return AresUtils.deepClone(state.notes);
    }

    function getNote(id) {
        if (!state) init();

        const note = state.notes.find(
            n => n.id === id
        );

        return note
            ? AresUtils.deepClone(note)
            : null;
    }

    function addNote(noteData) {
        if (!state) init();

        const note = {
            id: AresUtils.generateId(),
            title: noteData.title || 'Untitled Note',
            content: noteData.content || '',
            category: noteData.category || 'general',
            tags: noteData.tags || [],
            pinned: noteData.pinned || false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        state.notes.unshift(note);

        addActivity(
            'NOTE_CREATED',
            note.title,
            note.id
        );

        commit('NOTE_ADDED', note);

        return AresUtils.deepClone(note);
    }

    function updateNote(id, updates) {
        if (!state) init();

        const index = state.notes.findIndex(
            n => n.id === id
        );

        if (index === -1) return null;

        const allowedUpdates = [
            'title',
            'content',
            'category',
            'tags'
        ];

        allowedUpdates.forEach(key => {
            if (updates[key] !== undefined) {
                state.notes[index][key] = updates[key];
            }
        });

        state.notes[index].updatedAt = Date.now();

        commit('NOTE_UPDATED', {
            id,
            updates
        });

        return AresUtils.deepClone(
            state.notes[index]
        );
    }

    function deleteNote(id) {
        if (!state) init();

        const index = state.notes.findIndex(
            n => n.id === id
        );

        if (index === -1) return false;

        const deleted = state.notes[index];

        state.notes.splice(index, 1);

        commit('NOTE_DELETED', deleted);

        return true;
    }

    function toggleNotePin(id) {
        if (!state) init();

        const index = state.notes.findIndex(
            n => n.id === id
        );

        if (index === -1) return null;

        const note = state.notes[index];

        note.pinned = !note.pinned;
        note.updatedAt = Date.now();

        commit('NOTE_UPDATED', {
            id,
            pinned: note.pinned
        });

        return AresUtils.deepClone(note);
    }

    function searchNotes(query) {
        if (!state) init();

        if (!query || query.trim() === '') {
            return AresUtils.deepClone(state.notes);
        }

        const searchTerm =
            query.toLowerCase().trim();

        return AresUtils.deepClone(
            state.notes.filter(note => {
                const titleMatch =
                    note.title
                        .toLowerCase()
                        .includes(searchTerm);

                const contentMatch =
                    note.content
                        .toLowerCase()
                        .includes(searchTerm);

                const categoryMatch =
                    note.category
                        .toLowerCase()
                        .includes(searchTerm);

                const tagMatch =
                    note.tags.some(tag =>
                        tag.toLowerCase()
                            .includes(searchTerm)
                    );

                return (
                    titleMatch ||
                    contentMatch ||
                    categoryMatch ||
                    tagMatch
                );
            })
        );
    }

    /* ============ DAILY MISSION OPERATIONS ============ */

    function getTodayMissions() {
        if (!state) init();

        const todayKey =
            AresUtils.getTodayKey();

        const mission =
            state.dailyMissions[todayKey];

        return mission
            ? AresUtils.deepClone(
                mission.items || []
            )
            : [];
    }

    function addDailyMission(title) {
        if (!state) init();

        const todayKey =
            AresUtils.getTodayKey();

        if (!state.dailyMissions[todayKey]) {
            state.dailyMissions[todayKey] = {
                items: []
            };
        }

        const missionItem = {
            id: AresUtils.generateId(),
            title: title || 'Untitled Mission',
            completed: false,
            createdAt: Date.now()
        };

        state.dailyMissions[todayKey]
            .items.push(missionItem);

        commit(
            'MISSION_ADDED',
            missionItem
        );

        return AresUtils.deepClone(
            missionItem
        );
    }

    function toggleDailyMission(id) {
        if (!state) init();

        const todayKey =
            AresUtils.getTodayKey();

        const mission =
            state.dailyMissions[todayKey];

        if (!mission) return null;

        const index =
            mission.items.findIndex(
                item => item.id === id
            );

        if (index === -1) return null;

        const item = mission.items[index];

        item.completed = !item.completed;

        commit(
            'MISSION_TOGGLED',
            item
        );

        return AresUtils.deepClone(item);
    }

    function deleteDailyMission(id) {
        if (!state) init();

        const todayKey =
            AresUtils.getTodayKey();

        const mission =
            state.dailyMissions[todayKey];

        if (!mission) return false;

        const index =
            mission.items.findIndex(
                item => item.id === id
            );

        if (index === -1) return false;

        const deleted =
            mission.items[index];

        mission.items.splice(index, 1);

        commit(
            'MISSION_DELETED',
            deleted
        );

        return true;
    }

    function clearCompletedMissions() {
        if (!state) init();

        const todayKey =
            AresUtils.getTodayKey();

        const mission =
            state.dailyMissions[todayKey];

        if (!mission) return 0;

        const before =
            mission.items.length;

        mission.items =
            mission.items.filter(
                item => !item.completed
            );

        const cleared =
            before - mission.items.length;

        commit(
            'MISSIONS_CLEARED',
            cleared
        );

        return cleared;
    }

    /* ============ FOCUS SESSION OPERATIONS ============ */

    function addFocusSession(sessionData) {
        if (!state) init();

        const session = {
            id: AresUtils.generateId(),
            taskId: sessionData.taskId || null,
            duration: sessionData.duration || 0,
            completed:
                sessionData.completed !== false,
            startedAt:
                sessionData.startedAt || Date.now(),
            endedAt:
                sessionData.endedAt || Date.now()
        };

        state.focusSessions.push(session);

        if (
            session.completed &&
            session.duration > 0
        ) {
            addActivity(
                'FOCUS_COMPLETED',
                `Focus session: ${session.duration} min`,
                session.id
            );
        }

        commit(
            'FOCUS_SESSION_ADDED',
            session
        );

        return AresUtils.deepClone(session);
    }

    function getFocusSessions() {
        if (!state) init();

        return AresUtils.deepClone(
            state.focusSessions
        );
    }

    function getTodayFocusSessions() {
        if (!state) init();

        const today = new Date();

        today.setHours(
            0,
            0,
            0,
            0
        );

        const tomorrow = new Date(today);

        tomorrow.setDate(
            tomorrow.getDate() + 1
        );

        return AresUtils.deepClone(
            state.focusSessions.filter(
                session => {
                    const startedAt =
                        session.startedAt;

                    return (
                        startedAt >=
                            today.getTime() &&
                        startedAt <
                            tomorrow.getTime()
                    );
                }
            )
        );
    }

    function getTotalFocusMinutes() {
        if (!state) init();

        return state.focusSessions.reduce(
            (total, session) =>
                total + (session.duration || 0),
            0
        );
    }

    /* ============ ACTIVITY OPERATIONS ============ */

    function addActivity(
        type,
        title,
        entityId
    ) {
        if (!state) init();

        const activity = {
            id: AresUtils.generateId(),
            type: type || 'GENERAL',
            title: title || '',
            entityId: entityId || null,
            timestamp: Date.now()
        };

        state.activity.unshift(activity);

        if (state.activity.length > 500) {
            state.activity =
                state.activity.slice(0, 500);
        }
    }

    function getRecentActivity(limit) {
        if (!state) init();

        const maxItems = limit || 20;

        return AresUtils.deepClone(
            state.activity.slice(0, maxItems)
        );
    }

    /* ============ SETTINGS OPERATIONS ============ */

    function getSettings() {
        if (!state) init();

        return AresUtils.deepClone(
            state.settings
        );
    }

    function updateSettings(updates) {
        if (!state) init();

        Object.keys(updates).forEach(key => {
            if (
                state.settings.hasOwnProperty(key)
            ) {
                state.settings[key] =
                    updates[key];
            }
        });

        commit(
            'SETTINGS_UPDATED',
            updates
        );

        return AresUtils.deepClone(
            state.settings
        );
    }

    function setTheme(theme) {
        if (!state) init();

        const validTheme =
            theme === 'light'
                ? 'light'
                : 'dark';

        state.settings.theme =
            validTheme;

        AresUtils.applyTheme(
            validTheme
        );

        commit(
            'SETTINGS_UPDATED',
            {
                theme: validTheme
            }
        );

        return validTheme;
    }

    function setUserName(name) {
        if (!state) init();

        state.settings.userName =
            name || 'Ares';

        commit(
           
