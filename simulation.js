// MSRTC Commute - Simulation Engine
(function() {
    const STOPS = [
        "Solanpada",
        "Vijaybhoomi University",
        "Jamrung",
        "Ambivali",
        "Pinglas",
        "Kasheli",
        "Kadav",
        "Karjat Station",
        "Bus Depot"
    ];

    // Train schedule reference: CSMT Fast Local from Karjat Station Platform 3
    let trainDepartureMinutesFromNow = 35; 

    const state = {
        currentStopIndex: 0,
        progressBetweenStops: 0, // 0.0 to 1.0
        status: 'delayed', // Initial state matches demo presentation: delayed 16 min
        delayMinutes: 16,
        delayReason: 'Heavy traffic near Solanpada junction & road construction.',
        currentSpeed: 38, // km/h
        occupancy: '62% (Seats available)',
        alerts: [
            { 
                id: 1, 
                type: 'delay', 
                title: 'Delay Alert', 
                message: 'Route delayed by 16 mins due to road repairs near Solanpada.', 
                time: new Date(Date.now() - 2 * 60 * 1000) 
            },
            { 
                id: 2, 
                type: 'info', 
                title: 'Service Notice', 
                message: 'All morning services operating via Karjat Station Platform 3 connection.', 
                time: new Date(Date.now() - 15 * 60 * 1000) 
            },
            { 
                id: 3, 
                type: 'weather', 
                title: 'Weather Advisory', 
                message: 'Light morning mist. Bus traveling at safe regulated speed.', 
                time: new Date(Date.now() - 35 * 60 * 1000) 
            }
        ],
        lastUpdated: new Date()
    };

    const returnState = {
        currentStopIndex: 4, // Pinglas
        progressBetweenStops: 0,
        status: 'on_time',
        delayMinutes: 0,
        delayReason: 'Running smoothly on return trip.',
        currentSpeed: 45,
        occupancy: '35% (Seats available)',
        alerts: [],
        lastUpdated: new Date()
    };

    const listeners = [];
    let simulationTimer = null;
    let isPaused = false;

    function notifyListeners() {
        state.lastUpdated = new Date();
        returnState.lastUpdated = new Date();
        listeners.forEach(fn => {
            try {
                fn(state, returnState);
            } catch (err) {
                console.error("Error in listener callback:", err);
            }
        });
    }

    function subscribe(fn) {
        listeners.push(fn);
        fn(state, returnState); // Immediate initial sync
    }

    function formatTime(date) {
        if (!date) return '--:--';
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    // Returns estimated date of arrival at Karjat Station (index 7)
    function getBusETAAtStation() {
        const stationIndex = STOPS.indexOf("Karjat Station");
        if (state.currentStopIndex > stationIndex) {
            return null; // Already passed station
        }
        if (state.currentStopIndex === stationIndex) {
            return new Date(); // Right now at station
        }
        
        const stopsRemaining = stationIndex - state.currentStopIndex;
        let etaMinutes = (stopsRemaining * 5) + (state.status === 'delayed' ? state.delayMinutes : 0);
        etaMinutes -= Math.round(state.progressBetweenStops * 5);
        etaMinutes = Math.max(1, etaMinutes);
        
        const etaDate = new Date();
        etaDate.setMinutes(etaDate.getMinutes() + etaMinutes);
        return etaDate;
    }

    // Get expected arrival time at any specific stop index
    function getETAForStop(targetIndex) {
        if (targetIndex < state.currentStopIndex) return 'Passed';
        if (targetIndex === state.currentStopIndex) return 'Now';
        
        const stopsAway = targetIndex - state.currentStopIndex;
        let mins = (stopsAway * 5) + (state.status === 'delayed' ? Math.round(state.delayMinutes * 0.5) : 0);
        mins -= Math.round(state.progressBetweenStops * 5);
        mins = Math.max(1, mins);
        return `${mins} min`;
    }

    // Calculate travel time between any two stops (both directions)
    function getTravelTime(fromStop, toStop) {
        const fromIdx = STOPS.indexOf(fromStop);
        const toIdx = STOPS.indexOf(toStop);
        if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return 0;
        return Math.abs(toIdx - fromIdx) * 6; // 6 mins average per stop
    }

    // Get train departure date
    function getTrainDepartureTime() {
        const trainTime = new Date();
        trainTime.setMinutes(trainTime.getMinutes() + trainDepartureMinutesFromNow);
        return trainTime;
    }

    function addAlert(type, title, message) {
        state.alerts.unshift({
            id: Date.now(),
            type: type,
            title: title || (type === 'delay' ? 'Delay Alert' : 'Information'),
            message: message,
            time: new Date()
        });
        if (state.alerts.length > 8) {
            state.alerts.pop();
        }
    }

    // Trigger explicit manual delay (for exhibition interactive testing)
    function triggerDelay(minutes = 15, reason = 'Heavy traffic congestion reported ahead.') {
        state.status = 'delayed';
        state.delayMinutes = minutes;
        state.delayReason = reason;
        state.currentSpeed = 22;
        addAlert('delay', 'Traffic Delay', `${reason} Adding +${minutes} mins to ETA.`);
        notifyListeners();
    }

    // Clear delay
    function resolveDelay() {
        state.status = 'on_time';
        state.delayMinutes = 0;
        state.delayReason = 'Running smoothly on schedule.';
        state.currentSpeed = 46;
        addAlert('info', 'Schedule Restored', 'Traffic cleared ahead. Bus back on regular schedule.');
        notifyListeners();
    }

    // Advance to next stop
    function advanceStop() {
        if (state.currentStopIndex < STOPS.length - 1) {
            state.currentStopIndex++;
            state.progressBetweenStops = 0;
            addAlert('info', 'Stop Update', `Bus arrived at ${STOPS[state.currentStopIndex]}.`);
        } else {
            resetSimulation();
        }
        notifyListeners();
    }

    // Reset simulation
    function resetSimulation() {
        state.currentStopIndex = 0;
        state.progressBetweenStops = 0;
        state.status = 'delayed';
        state.delayMinutes = 16;
        state.delayReason = 'Heavy traffic near Solanpada junction & road construction.';
        state.currentSpeed = 38;
        trainDepartureMinutesFromNow = 35;
        addAlert('info', 'Demo Reset', 'Bus route restarted at Solanpada for presentation.');
        notifyListeners();
    }

    // Main background simulation loop
    function startSimulation() {
        if (simulationTimer) clearInterval(simulationTimer);
        
        simulationTimer = setInterval(() => {
            if (isPaused) return;

            // Advance progress between stops
            if (state.currentStopIndex < STOPS.length - 1) {
                state.progressBetweenStops += 0.2; // Smooth 5-step transition per stop
                
                // Speed variation
                state.currentSpeed = state.status === 'delayed' 
                    ? Math.floor(20 + Math.random() * 15) 
                    : Math.floor(40 + Math.random() * 15);

                if (state.progressBetweenStops >= 1) {
                    state.progressBetweenStops = 0;
                    state.currentStopIndex++;
                    
                    const currentStopName = STOPS[state.currentStopIndex];
                    if (state.currentStopIndex < STOPS.length - 1) {
                        if (Math.random() > 0.6) {
                            addAlert('info', 'Stop Reached', `Bus has arrived at ${currentStopName}.`);
                        }
                    } else {
                        addAlert('info', 'Route Complete', `Bus reached final destination: ${currentStopName}.`);
                    }
                }
            } else {
                // Loop simulation seamlessly for exhibition display
                state.currentStopIndex = 0;
                state.progressBetweenStops = 0;
                state.status = 'on_time';
                state.delayMinutes = 0;
                trainDepartureMinutesFromNow = 40;
                addAlert('info', 'Service Restart', 'MSRTC 147 started new scheduled trip from Solanpada.');
            }

            // Dynamic random events during live run
            const rand = Math.random();
            if (rand > 0.94 && state.status === 'on_time') {
                state.status = 'delayed';
                state.delayMinutes = Math.floor(Math.random() * 10) + 8;
                state.delayReason = `Slow moving traffic near ${STOPS[state.currentStopIndex]}.`;
                addAlert('delay', 'Congestion Alert', `${state.delayReason} Expected delay: ${state.delayMinutes} mins.`);
            } else if (rand > 0.92 && state.status === 'delayed') {
                state.status = 'on_time';
                state.delayMinutes = 0;
                state.delayReason = 'Route clear. Running on time.';
                addAlert('info', 'Delay Cleared', 'Traffic normal. Bus is back on schedule.');
            }

            // Advance return progress
            if (returnState.currentStopIndex > 0) {
                returnState.progressBetweenStops += 0.2;
                returnState.currentSpeed = returnState.status === 'delayed' 
                    ? Math.floor(20 + Math.random() * 15) 
                    : Math.floor(40 + Math.random() * 15);

                if (returnState.progressBetweenStops >= 1) {
                    returnState.progressBetweenStops = 0;
                    returnState.currentStopIndex--;
                }
            } else {
                returnState.currentStopIndex = STOPS.length - 1;
                returnState.progressBetweenStops = 0;
                returnState.status = 'on_time';
                returnState.delayMinutes = 0;
            }

            notifyListeners();
        }, 3500); // 3.5s per tick for lively exhibition demonstration
    }

    // Expose complete API to window
    window.BusSimulation = {
        STOPS,
        state,
        returnState,
        subscribe,
        notifyListeners,
        startSimulation,
        triggerDelay,
        resolveDelay,
        advanceStop,
        resetSimulation,
        formatTime,
        getBusETAAtStation,
        getETAForStop,
        getTravelTime,
        getTrainDepartureTime,
        addAlert
    };
})();

